import { sleep } from '../utils/sleep';

/**
 * Token-bucket rate limiter with queue-based request throttling.
 *
 * Prevents 429 responses by proactively limiting outgoing requests.
 * When a 429 is received, `penalize()` pauses all requests for the
 * specified Retry-After duration.
 */
export interface RateLimiterOptions {
  /** Max requests allowed per time window (default: 20) */
  maxRequests?: number;
  /** Time window in ms (default: 10_000 = 10 seconds) */
  windowMs?: number;
}

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private timestamps: number[] = [];
  private penaltyUntil = 0;
  private readonly queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  private processing = false;
  private _disposed = false;

  constructor(options?: RateLimiterOptions) {
    this.maxRequests = options?.maxRequests ?? 20;
    this.windowMs = options?.windowMs ?? 10_000;
  }

  /**
   * Acquire a slot to make a request.
   * Resolves when it's safe to proceed. Queues if the rate limit is reached.
   */
  async acquire(): Promise<void> {
    if (this._disposed) return;

    // If we're in a penalty window, wait it out
    const now = Date.now();
    if (this.penaltyUntil > now) {
      await sleep(this.penaltyUntil - now);
    }

    // Clean up expired timestamps
    this.pruneTimestamps();

    // If under the limit, proceed immediately
    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(Date.now());
      return;
    }

    // Otherwise, queue and wait
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Called when a 429 response is received.
   * Pauses all requests for the specified duration.
   */
  penalize(retryAfterMs: number): void {
    const until = Date.now() + retryAfterMs;
    if (until > this.penaltyUntil) {
      this.penaltyUntil = until;
    }
  }

  /**
   * Number of requests currently queued.
   */
  get queueSize(): number {
    return this.queue.length;
  }

  /**
   * Number of requests made in the current window.
   */
  get currentUsage(): number {
    this.pruneTimestamps();
    return this.timestamps.length;
  }

  /**
   * Whether the limiter is in a penalty state from a 429 response.
   */
  get isPenalized(): boolean {
    return Date.now() < this.penaltyUntil;
  }

  /**
   * Clean up timers and reject queued requests.
   */
  dispose(): void {
    this._disposed = true;
    for (const entry of this.queue) {
      entry.reject(new Error('RateLimiter disposed'));
    }
    this.queue.length = 0;
  }

  private pruneTimestamps(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this._disposed) return;
    this.processing = true;

    while (this.queue.length > 0 && !this._disposed) {
      // Wait for penalty to clear
      const now = Date.now();
      if (this.penaltyUntil > now) {
        await sleep(this.penaltyUntil - now);
      }

      this.pruneTimestamps();

      if (this.timestamps.length < this.maxRequests) {
        const entry = this.queue.shift();
        if (entry) {
          this.timestamps.push(Date.now());
          entry.resolve();
        }
      } else {
        // Wait until the oldest timestamp expires
        const waitMs = this.timestamps[0] + this.windowMs - Date.now() + 1;
        if (waitMs > 0) {
          await sleep(waitMs);
        }
      }
    }

    this.processing = false;
  }
}
