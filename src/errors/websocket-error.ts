import { EToroError } from './base-error';

export class EToroWebSocketError extends EToroError {
  constructor(
    message: string,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'EToroWebSocketError';
  }
}
