import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  withExponentialBackoff,
  computeBackoffDelay,
  HttpServiceError,
} from '../../server/resilience';
import {
  sanitizePayload,
  isOriginAllowed,
  createRateLimiter,
} from '../../server/securityMiddleware';

describe('Backend Proxy Hardening - Seguridad y Resiliencia', () => {
  describe('withExponentialBackoff', () => {
    it('retorna el resultado inmediatamente si la operación es exitosa en el primer intento', async () => {
      const op = vi.fn().mockResolvedValue('ok');
      const result = await withExponentialBackoff(op, { maxRetries: 3, baseDelayMs: 10 });
      expect(result).toBe('ok');
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('reintenta ante fallos transitorios HTTP 503 y resuelve cuando el servicio se recupera', async () => {
      let calls = 0;
      const op = vi.fn().mockImplementation(async () => {
        calls++;
        if (calls < 3) {
          throw new HttpServiceError('Service Unavailable', 503);
        }
        return 'recovered';
      });

      const onRetry = vi.fn();
      const result = await withExponentialBackoff(op, {
        maxRetries: 3,
        baseDelayMs: 5,
        maxDelayMs: 20,
        jitterFactor: 0,
        onRetry,
      });

      expect(result).toBe('recovered');
      expect(op).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('NO reintenta errores 401/400 no recuperables ni fallos DNS de host interno clanfdbsw06', async () => {
      const authOp = vi.fn().mockRejectedValue(new HttpServiceError('Unauthorized', 401, false));
      await expect(
        withExponentialBackoff(authOp, { maxRetries: 3, baseDelayMs: 5 })
      ).rejects.toThrow('Unauthorized');
      expect(authOp).toHaveBeenCalledTimes(1);

      const dnsErr = Object.assign(new Error('getaddrinfo ENOTFOUND clanfdbsw06'), { code: 'ENOTFOUND' });
      const dnsOp = vi.fn().mockRejectedValue(dnsErr);
      await expect(
        withExponentialBackoff(dnsOp, { maxRetries: 3, baseDelayMs: 5 })
      ).rejects.toThrow('clanfdbsw06');
      expect(dnsOp).toHaveBeenCalledTimes(1);
    });

    it('respeta los límites de computeBackoffDelay con jitter', () => {
      const delay = computeBackoffDelay(2, 100, 1000, 0.25);
      // base=100 * 2^2 = 400 +/- 25% => [300, 500]
      expect(delay).toBeGreaterThanOrEqual(300);
      expect(delay).toBeLessThanOrEqual(500);
    });
  });

  describe('sanitizePayload', () => {
    it('elimina claves peligrosas de prototype pollution y caracteres de control', () => {
      const malicious = JSON.parse(
        '{"__proto__":{"polluted":true},"constructor":{"bad":1},"title":"Reporte\\u0000\\u0007 Turno","nested":{"rows":[1,2,3]}}'
      );

      const cleaned = sanitizePayload(malicious) as Record<string, any>;
      expect(Object.prototype.hasOwnProperty.call(cleaned, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(cleaned, 'constructor')).toBe(false);
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect(cleaned.title).toBe('Reporte Turno');
      expect(cleaned.nested.rows).toEqual([1, 2, 3]);
    });

    it('corta recursión excesiva cuando se excede maxDepth', () => {
      const deep = { a: { b: { c: { d: 'too-deep' } } } };
      const cleaned = sanitizePayload(deep, 0, 2) as any;
      expect(cleaned.a.b.c).toBeNull();
    });
  });

  describe('isOriginAllowed (CORS Allowlist)', () => {
    it('autoriza orígenes de Vercel, localhost y AI Studio y bloquea dominios externos', () => {
      expect(isOriginAllowed('http://localhost:3000')).toBe(true);
      expect(isOriginAllowed('https://despacho-litio.vercel.app')).toBe(true);
      expect(isOriginAllowed('https://ais-dev-demo-123.us-east1.run.app')).toBe(true);
      expect(isOriginAllowed('https://aistudio.google.com')).toBe(true);
      expect(isOriginAllowed('https://custom.sqm-corp.cl', ['https://custom.sqm-corp.cl'])).toBe(true);

      expect(isOriginAllowed('https://evil-phishing.example.com')).toBe(false);
      expect(isOriginAllowed('not-a-valid-url')).toBe(false);
    });
  });

  describe('createRateLimiter', () => {
    it('bloquea con HTTP 429 y Retry-After cuando se supera maxRequests en la ventana', () => {
      const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2, keyPrefix: 'test' });

      const makeReqRes = () => {
        const headers: Record<string, string> = {};
        let statusCode = 200;
        let jsonBody: unknown = null;
        const req = {
          headers: { 'x-forwarded-for': '10.20.30.40' },
          ip: '10.20.30.40',
          socket: { remoteAddress: '10.20.30.40' },
        } as unknown as Request;
        const res = {
          setHeader: (k: string, v: string) => {
            headers[k] = v;
          },
          status: (code: number) => {
            statusCode = code;
            return res;
          },
          json: (body: unknown) => {
            jsonBody = body;
            return res;
          },
        } as unknown as Response;
        const next = vi.fn();
        return { req, res, next, getResult: () => ({ headers, statusCode, jsonBody }) };
      };

      const r1 = makeReqRes();
      limiter(r1.req, r1.res, r1.next);
      expect(r1.next).toHaveBeenCalledTimes(1);

      const r2 = makeReqRes();
      limiter(r2.req, r2.res, r2.next);
      expect(r2.next).toHaveBeenCalledTimes(1);

      const r3 = makeReqRes();
      limiter(r3.req, r3.res, r3.next);
      expect(r3.next).not.toHaveBeenCalled();
      expect(r3.getResult().statusCode).toBe(429);
      expect(r3.getResult().headers['Retry-After']).toBeDefined();
    });
  });
});
