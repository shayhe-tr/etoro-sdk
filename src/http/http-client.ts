import type { EToroConfigWithLogger } from '../config/config';
import { generateUUID } from '../utils/uuid';
import { noopLogger } from '../utils/logger';
import { retry } from './retry';
import { RateLimiter, type RateLimiterOptions } from './rate-limiter';
import { EToroApiError } from '../errors/api-error';
import { EToroAuthError } from '../errors/auth-error';
import { EToroRateLimitError } from '../errors/rate-limit-error';

export interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  requestId?: string;
}

export interface HttpClientOptions {
  /** Rate limiter configuration. Pass `false` to disable rate limiting. */
  rateLimiter?: RateLimiterOptions | false;
}

export class HttpClient {
  private readonly logger;
  private readonly rateLimiter: RateLimiter | null;

  constructor(
    private readonly config: EToroConfigWithLogger,
    options?: HttpClientOptions,
  ) {
    this.logger = config.logger ?? noopLogger;
    this.rateLimiter = options?.rateLimiter === false
      ? null
      : new RateLimiter(options?.rateLimiter);
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const requestId = options.requestId ?? generateUUID();
    const startTime = Date.now();

    return retry(
      async () => {
        if (this.rateLimiter) {
          await this.rateLimiter.acquire();
        }
        return this.executeRequest<T>(options, requestId, startTime);
      },
      {
        attempts: this.config.retryAttempts,
        delay: this.config.retryDelay,
        jitter: true,
        shouldRetry: (error) => this.isRetryable(error),
        getRetryAfterMs: (error) => {
          if (error instanceof EToroRateLimitError && error.retryAfterMs) {
            if (this.rateLimiter) {
              this.rateLimiter.penalize(error.retryAfterMs);
            }
            return error.retryAfterMs;
          }
          return undefined;
        },
        onRetry: (attempt, waitMs, error) => {
          this.logger.warn(
            `Retrying ${options.method} ${options.path} (attempt ${attempt}, waiting ${Math.round(waitMs)}ms)`,
            { requestId, error: (error as Error).message },
          );
        },
      },
    );
  }

  private async executeRequest<T>(
    options: RequestOptions,
    requestId: string,
    startTime: number,
  ): Promise<T> {
    const url = this.buildUrl(options.path, options.query);

    const headers: Record<string, string> = {
      'x-request-id': requestId,
      'x-api-key': this.config.apiKey,
      'x-user-key': this.config.userKey,
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const init: RequestInit = {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout),
    };

    this.logger.debug(`${options.method} ${url}`, { requestId });

    const response = await fetch(url, init);
    const durationMs = Date.now() - startTime;

    if (response.status === 204) {
      return undefined as T;
    }

    if (response.status === 401 || response.status === 403) {
      throw new EToroAuthError(
        `Authentication failed (${response.status})`,
        requestId,
      );
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new EToroRateLimitError(
        'Rate limit exceeded',
        retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
        requestId,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => undefined);
      throw new EToroApiError(
        `API request failed: ${response.status} ${response.statusText}`,
        response.status,
        body,
        requestId,
        {
          method: options.method,
          path: options.path,
          durationMs,
        },
      );
    }

    const text = await response.text();
    if (!text) return undefined as T;

    return JSON.parse(text) as T;
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof EToroRateLimitError) return true;
    if (error instanceof EToroApiError && error.statusCode >= 500) return true;
    if (error instanceof TypeError) return true; // network errors
    return false;
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path, this.config.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  dispose(): void {
    this.rateLimiter?.dispose();
  }
}
