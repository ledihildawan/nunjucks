interface BaseValidationError {
  message: string;
  code?: string;
  subject?: string;
  lineno?: number;
  colno?: number;
}

export type { BaseValidationError };
