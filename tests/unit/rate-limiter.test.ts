import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../../src/http/rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests under the limit', async () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(limiter.currentUsage).toBe(3);
    limiter.dispose();
  });

  it('should queue requests when limit is reached', async () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.currentUsage).toBe(2);

    // Third request should be queued
    const thirdAcquire = limiter.acquire();
    expect(limiter.queueSize).toBe(1);

    // Advance time past the window so a slot opens
    vi.advanceTimersByTime(1001);
    await thirdAcquire;
    expect(limiter.queueSize).toBe(0);

    limiter.dispose();
  });

  it('should respect penalty from penalize()', async () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });

    limiter.penalize(5000);
    expect(limiter.isPenalized).toBe(true);

    const acquirePromise = limiter.acquire();

    // Should not resolve yet
    vi.advanceTimersByTime(3000);
    expect(limiter.isPenalized).toBe(true);

    // Advance past penalty
    vi.advanceTimersByTime(2001);
    await acquirePromise;
    expect(limiter.isPenalized).toBe(false);

    limiter.dispose();
  });

  it('should reject queued requests on dispose', async () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });

    await limiter.acquire();

    const promise = limiter.acquire();
    expect(limiter.queueSize).toBe(1);

    limiter.dispose();
    await expect(promise).rejects.toThrow('RateLimiter disposed');
  });

  it('should report correct currentUsage after window expires', async () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });

    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.currentUsage).toBe(2);

    vi.advanceTimersByTime(1001);
    expect(limiter.currentUsage).toBe(0);

    limiter.dispose();
  });

  it('should use defaults when no options provided', () => {
    const limiter = new RateLimiter();
    // Should not throw — just verify it constructs with defaults
    expect(limiter.currentUsage).toBe(0);
    expect(limiter.queueSize).toBe(0);
    expect(limiter.isPenalized).toBe(false);
    limiter.dispose();
  });
});
