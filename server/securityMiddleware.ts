import type { NextFunction, Request, Response } from 'express';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Sanea recursivamente cualquier estructura JSON entrante para prevenir
 * prototype pollution, inyección de caracteres de control y desbordamiento por profundidad.
 */
export function sanitizePayload(value: unknown, depth = 0, maxDepth = 8, maxStringLen = 50_000): unknown {
  if (depth > maxDepth) {
    return null;
  }

  if (typeof value === 'string') {
    return value.replace(CONTROL_CHARS_REGEX, '').slice(0, maxStringLen);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'boolean' || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 500).map((item) => sanitizePayload(item, depth + 1, maxDepth, maxStringLen));
  }

  if (typeof value === 'object') {
    const cleanObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      const cleanKey = key.replace(CONTROL_CHARS_REGEX, '').slice(0, 128);
      if (!cleanKey) continue;
      cleanObj[cleanKey] = sanitizePayload(val, depth + 1, maxDepth, maxStringLen);
    }
    return cleanObj;
  }

  return undefined;
}

/**
 * Middleware Express para cabeceras de seguridad HTTP estándar.
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

/**
 * Verifica si un Origin pertenece a la lista blanca (Vercel, localhost o AI Studio).
 */
export function isOriginAllowed(origin: string, extraAllowedOrigins: string[] = []): boolean {
  if (!origin) return true; // Solicitudes same-origin o server-to-server sin cabecera Origin

  const normalized = origin.trim().toLowerCase();

  for (const allowed of extraAllowedOrigins) {
    if (allowed && normalized === allowed.trim().toLowerCase()) {
      return true;
    }
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();

    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return true;
    }

    if (host.endsWith('.vercel.app')) {
      return true;
    }

    if (host.endsWith('.run.app') || host === 'aistudio.google.com' || host.endsWith('.aistudio.google.com')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Middleware CORS con allowlist estricta para Vercel, localhost y AI Studio.
 */
export function createCorsAllowlistMiddleware(extraOrigins: string[] = []) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';

    if (!origin) {
      return next();
    }

    if (!isOriginAllowed(origin, extraOrigins)) {
      res.status(403).json({
        error: 'Origen no autorizado por la política CORS de Despacho-Litio.',
        origin,
      });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

/**
 * Middleware que sanea body, query y params en cada solicitud entrante.
 */
export function sanitizeInputMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizePayload(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    const sanitizedQuery = sanitizePayload(req.query, 0, 3, 2048) as Record<string, any>;
    for (const [k, v] of Object.entries(sanitizedQuery)) {
      (req.query as Record<string, any>)[k] = v;
    }
  }
  if (req.params && typeof req.params === 'object') {
    const sanitizedParams = sanitizePayload(req.params, 0, 2, 512) as Record<string, any>;
    for (const [k, v] of Object.entries(sanitizedParams)) {
      req.params[k] = String(v ?? '');
    }
  }
  next();
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

interface RateBucket {
  timestamps: number[];
}

/**
 * Limitador de velocidad en ventana deslizante en memoria (compatible con Vercel Serverless).
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, maxRequests, keyPrefix = 'api' } = options;
  const buckets = new Map<string, RateBucket>();
  let lastCleanup = Date.now();

  const cleanupStaleBuckets = (now: number) => {
    if (now - lastCleanup < windowMs) return;
    lastCleanup = now;
    const cutoff = now - windowMs;
    for (const [key, bucket] of buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
      if (bucket.timestamps.length === 0) {
        buckets.delete(key);
      }
    }
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    cleanupStaleBuckets(now);

    const forwardedFor = typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : '';
    const clientIp = forwardedFor || req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${clientIp}`;

    const cutoff = now - windowMs;
    const bucket = buckets.get(key) || { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

    const remainingBefore = Math.max(0, maxRequests - bucket.timestamps.length);
    const resetSeconds = Math.ceil(windowMs / 1000);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));

    if (bucket.timestamps.length >= maxRequests) {
      const oldestTs = bucket.timestamps[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldestTs + windowMs - now) / 1000));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Demasiadas solicitudes en un corto período. Intenta nuevamente en unos segundos.',
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    bucket.timestamps.push(now);
    buckets.set(key, bucket);
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remainingBefore - 1)));
    next();
  };
}
