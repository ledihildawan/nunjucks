import type { NunjucksErrorMetadata } from './base.ts';
import { NunjucksError } from './base.ts';

export class ValidationError extends NunjucksError {
  constructor(message: string, metadata: NunjucksErrorMetadata = {}) {
    super(message, metadata);
    this.name = 'ValidationError';
  }
}

export function isValidationError(value: unknown): value is ValidationError {
  return value instanceof ValidationError;
}
