import type { NunjucksErrorMetadata } from './base.ts';
import { NunjucksError } from './base.ts';

export class LoaderError extends NunjucksError {
  constructor(message: string, metadata: NunjucksErrorMetadata = {}) {
    super(message, metadata);
    this.name = 'LoaderError';
  }
}
