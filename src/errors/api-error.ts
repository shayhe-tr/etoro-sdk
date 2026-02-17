import { EToroError } from './base-error';

export interface RequestContext {
  method: string;
  path: string;
  durationMs: number;
}

export class EToroApiError extends EToroError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: unknown,
    public readonly requestId?: string,
    public readonly requestContext?: RequestContext,
  ) {
    super(message);
    this.name = 'EToroApiError';
  }
}
