import { EToroError } from './base-error';

export class EToroValidationError extends EToroError {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'EToroValidationError';
  }
}
