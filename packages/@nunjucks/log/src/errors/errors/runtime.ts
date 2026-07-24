import type { NunjucksErrorMetadata } from './base.ts';
import { NunjucksError } from './base.ts';

export class RenderError extends NunjucksError {
  constructor(message: string, metadata: NunjucksErrorMetadata = {}) {
    super(message, metadata);
    this.name = 'RenderError';
  }
}

export function isRenderError(value: unknown): value is RenderError {
  return value instanceof RenderError;
}
