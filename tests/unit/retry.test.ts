import { describe, it, expect, vi } from 'vitest';
import { retry } from '../../src/http/retry';

describe('retry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retry(fn, {
      attempts: 3,
      delay: 10,
      shouldRetry: () => true,
    });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const result = await retry(fn, {
      attempts: 3,
      delay: 10,
      shouldRetry: () => true,
      jitter: false,
    });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max attempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(
      retry(fn, {
        attempts: 3,
        delay: 10,
        shouldRetry: () => true,
        jitter: false,
      }),
    ).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('no retry'));

    await expect(
      retry(fn, {
        attempts: 3,
        delay: 10,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow('no retry');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should apply exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('success');

    const start = Date.now();
    await retry(fn, {
      attempts: 3,
      delay: 50,
      backoffMultiplier: 2,
      jitter: false,
      shouldRetry: () => true,
    });
    const elapsed = Date.now() - start;

    // First retry: 50ms, second retry: 100ms = 150ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use getRetryAfterMs when provided', async () => {
    const error = new Error('rate limited');
    (error as any).retryAfterMs = 200;

    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const start = Date.now();
    await retry(fn, {
      attempts: 3,
      delay: 10,
      jitter: false,
      shouldRetry: () => true,
      getRetryAfterMs: (err) => (err as any).retryAfterMs,
    });
    const elapsed = Date.now() - start;

    // Should wait the Retry-After time (200ms), not the computed backoff (10ms)
    expect(elapsed).toBeGreaterThanOrEqual(180);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should call onRetry callback before each retry', async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('success');

    await retry(fn, {
      attempts: 3,
      delay: 10,
      jitter: false,
      shouldRetry: () => true,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, 10, expect.any(Error));
    expect(onRetry).toHaveBeenCalledWith(2, 20, expect.any(Error));
  });

  it('should not apply jitter to Retry-After values', async () => {
    const error = new Error('rate limited');
    (error as any).retryAfterMs = 100;

    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    await retry(fn, {
      attempts: 3,
      delay: 10,
      jitter: true, // jitter enabled, but should not apply to Retry-After
      shouldRetry: () => true,
      getRetryAfterMs: (err) => (err as any).retryAfterMs,
      onRetry,
    });

    // The wait time should be exactly 100ms (the Retry-After value), not jittered
    expect(onRetry).toHaveBeenCalledWith(1, 100, expect.any(Error));
  });

  it('should apply jitter when enabled and no Retry-After', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    await retry(fn, {
      attempts: 3,
      delay: 100,
      jitter: true,
      shouldRetry: () => true,
      getRetryAfterMs: () => undefined,
      onRetry,
    });

    // Jitter is +/- 25%, so wait should be between 75 and 125
    const waitMs = onRetry.mock.calls[0][1];
    expect(waitMs).toBeGreaterThanOrEqual(75);
    expect(waitMs).toBeLessThanOrEqual(125);
  });
});
