import type { NunjucksErrorMetadata } from './base.ts';
import { NunjucksError } from './base.ts';

export class TimeoutError extends NunjucksError {
  constructor(message: string, metadata: NunjucksErrorMetadata = {}) {
    super(message, metadata);
    this.name = 'TimeoutError';
  }
}

export function isTimeoutError(value: unknown): value is TimeoutError {
  return value instanceof TimeoutError;
}
