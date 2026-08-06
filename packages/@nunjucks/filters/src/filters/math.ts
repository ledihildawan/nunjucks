import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { requireNumberError } from '../factory/index.ts';

export const abs = (val: unknown): number => {
  if (typeof val !== 'number') { throw requireNumberError(val, ERROR_DEFINITIONS.MATH_FILTER); }
  return Math.abs(val);
};

export const round = (val: unknown, precision = 0, method?: 'ceil' | 'floor' | 'round'): number => {
  if (typeof val !== 'number') { throw requireNumberError(val, ERROR_DEFINITIONS.MATH_FILTER); }
  const factor = 10 ** precision;
  const rounder = method === 'ceil' ? Math.ceil : method === 'floor' ? Math.floor : Math.round;
  return rounder(val * factor) / factor;
};
