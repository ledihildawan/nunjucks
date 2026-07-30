import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { makeFilterError } from '../factory/index.ts';

export const abs = (val: unknown): number => {
  if (typeof val !== 'number') {
    throw makeFilterError(ERROR_DEFINITIONS.MATH_FILTER, { type: typeof val }, typeof val, `Expected number but got ${typeof val}`);
  }
  return Math.abs(val);
};

export const round = (val: unknown, precision = 0, method?: 'ceil' | 'floor' | 'round'): number => {
  if (typeof val !== 'number') {
    throw makeFilterError(ERROR_DEFINITIONS.MATH_FILTER, { type: typeof val }, typeof val, `Expected number but got ${typeof val}`);
  }
  const factor = 10 ** precision;
  const rounder = method === 'ceil' ? Math.ceil : method === 'floor' ? Math.floor : Math.round;
  return rounder(val * factor) / factor;
};
