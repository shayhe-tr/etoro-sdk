import { sleep } from '../utils/sleep';

export interface RetryOptions {
  attempts: number;
  delay: number;
  backoffMultiplier?: number;
  /** If true, adds +/- 25% random jitter to delay to avoid thundering herd (default: true) */
  jitter?: boolean;
  shouldRetry: (error: unknown) => boolean;
  /** Extract a Retry-After delay (ms) from an error. If returned, overrides computed backoff. */
  getRetryAfterMs?: (error: unknown) => number | undefined;
  /** Called before each retry with attempt number and wait time (ms) */
  onRetry?: (attempt: number, waitMs: number, error: unknown) => void;
}

/**
 * Retry with exponential backoff, jitter, and Retry-After support.
 *
 * Priority for delay:
 * 1. Retry-After from the error (via `getRetryAfterMs`)
 * 2. Exponential backoff: `delay * backoffMultiplier ^ attempt`
 * 3. Jitter: +/- 25% random (unless disabled)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    attempts,
    delay,
    backoffMultiplier = 2,
    jitter = true,
    shouldRetry,
    getRetryAfterMs,
    onRetry,
  } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1 && shouldRetry(error)) {
        // Use Retry-After if available, otherwise exponential backoff
        const retryAfter = getRetryAfterMs?.(error);
        let waitMs = retryAfter ?? delay * Math.pow(backoffMultiplier, attempt);

        // Apply jitter (only to computed backoff, not to Retry-After)
        if (jitter && retryAfter === undefined) {
          waitMs = applyJitter(waitMs);
        }

        onRetry?.(attempt + 1, waitMs, error);
        await sleep(waitMs);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

/**
 * Applies +/- 25% random jitter to a delay value.
 * Prevents thundering herd when many clients retry simultaneously.
 */
function applyJitter(ms: number): number {
  const jitterRange = ms * 0.25;
  return ms + (Math.random() * 2 - 1) * jitterRange;
}
