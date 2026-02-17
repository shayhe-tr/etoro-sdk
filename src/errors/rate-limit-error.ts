import { EToroApiError } from './api-error';

export class EToroRateLimitError extends EToroApiError {
  public readonly retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number, requestId?: string) {
    super(message, 429, undefined, requestId);
    this.name = 'EToroRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}
