export interface BackoffOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
  timeoutMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export class HttpServiceError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status: number, retryable?: boolean) {
    super(message);
    this.name = 'HttpServiceError';
    this.status = status;
    this.retryable = retryable ?? (status === 429 || status >= 500);
  }
}

export function defaultShouldRetry(error: unknown): boolean {
  if (error instanceof HttpServiceError) {
    return error.retryable;
  }

  if (error && typeof error === 'object') {
    const errObj = error as { status?: number; code?: string; name?: string; message?: string };

    // No reintentar errores de autorización o payload inválido
    if (typeof errObj.status === 'number' && errObj.status >= 400 && errObj.status < 500 && errObj.status !== 429) {
      return false;
    }

    // Errores DNS de host corporativo interno no se resuelven con reintentos en nube pública
    if (errObj.code === 'ENOTFOUND' || errObj.code === 'EAI_AGAIN') {
      if (String(errObj.message || '').includes('clanfdbsw06')) {
        return false;
      }
    }

    // Errores transitorios de red o timeout
    if (
      errObj.name === 'AbortError' ||
      errObj.code === 'ECONNRESET' ||
      errObj.code === 'ETIMEDOUT' ||
      errObj.code === 'EPIPE'
    ) {
      return true;
    }
  }

  return true;
}

export function computeBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number
): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  const jitterRange = exp * Math.max(0, Math.min(1, jitterFactor));
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(10, Math.round(exp + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ejecuta una operación asíncrona con backoff exponencial, jitter aleatorio y timeout por intento.
 */
export async function withExponentialBackoff<T>(
  operation: (signal: AbortSignal, attempt: number) => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 250,
    maxDelayMs = 5000,
    jitterFactor = 0.25,
    timeoutMs = 15000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const result = await operation(controller.signal, attempt);
      if (timer) clearTimeout(timer);
      return result;
    } catch (error) {
      if (timer) clearTimeout(timer);
      lastError = error;

      const canRetry = attempt < maxRetries && shouldRetry(error, attempt);
      if (!canRetry) {
        throw error;
      }

      const delayMs = computeBackoffDelay(attempt, baseDelayMs, maxDelayMs, jitterFactor);
      if (onRetry) {
        onRetry(error, attempt + 1, delayMs);
      }
      await sleep(delayMs);
    }
  }

  throw lastError;
}
