/**
 * Defines the minimal error envelope validators emit — position and subject fields stay
 * optional because not every failure pins to a source location.
 */
interface BaseValidationError {
  message: string;
  code?: string;
  subject?: string;
  lineno?: number;
  colno?: number;
}

export type { BaseValidationError };
