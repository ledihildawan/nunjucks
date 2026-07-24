import type { NunjucksErrorMetadata } from './base.ts';
import { NunjucksError } from './base.ts';

export class TemplateSyntaxError extends NunjucksError {
  constructor(message: string, metadata: NunjucksErrorMetadata = {}) {
    super(message, metadata);
    this.name = 'TemplateSyntaxError';
  }
}
