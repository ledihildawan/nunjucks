import type { NunjucksErrorMetadata } from './base.ts';
import { NunjucksError } from './base.ts';

export class SecurityError extends NunjucksError {
  constructor(message: string, metadata: NunjucksErrorMetadata = {}) {
    super(message, metadata);
    this.name = 'SecurityError';
  }
}

export function isSecurityError(value: unknown): value is SecurityError {
  return value instanceof SecurityError;
}
