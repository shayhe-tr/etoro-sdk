import { EToroError } from './base-error';

export class EToroAuthError extends EToroError {
  constructor(
    message: string = 'Authentication failed',
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'EToroAuthError';
  }
}
