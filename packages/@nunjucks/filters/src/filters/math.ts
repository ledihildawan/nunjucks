import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { filterError } from '../factory/index.ts';

export const abs = (val: unknown): number => {
  if (typeof val !== 'number') {
    throw filterError(undefined, ERROR_DEFINITIONS.MATH_FILTER!, { type: typeof val }, typeof val);
  }
  return Math.abs(val);
};

export const round = (val: unknown, precision: number = 0, method?: 'ceil' | 'floor' | 'round'): number => {
  if (typeof val !== 'number') {
    throw filterError(undefined, ERROR_DEFINITIONS.MATH_FILTER!, { type: typeof val }, typeof val);
  }
  const factor = Math.pow(10, precision);
  let rounder: (x: number) => number;
  if (method === 'ceil') rounder = Math.ceil;
  else if (method === 'floor') rounder = Math.floor;
  else rounder = Math.round;
  return rounder(val * factor) / factor;
};
