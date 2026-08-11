import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { requireNumberError } from '../factory/index.ts';

export const abs = (value: unknown): number => {
  if (typeof value !== 'number') { throw requireNumberError(value, ERROR_DEFINITIONS.MATH_FILTER); }
  return Math.abs(value);
};

export const round = (value: unknown, precision = 0, method?: 'ceil' | 'floor' | 'round'): number => {
  if (typeof value !== 'number') { throw requireNumberError(value, ERROR_DEFINITIONS.MATH_FILTER); }
  const factor = 10 ** precision;
  const rounder = method === 'ceil' ? Math.ceil : method === 'floor' ? Math.floor : Math.round;
  return rounder(value * factor) / factor;
};
