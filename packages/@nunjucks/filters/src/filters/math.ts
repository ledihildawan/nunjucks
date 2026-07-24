import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { filterError } from '../factory/index.ts';

export const abs = (val: unknown): number => {
  if (typeof val !== 'number') {
    const errorDef = ERROR_DEFINITIONS.MATH_FILTER;
    if (errorDef) {
      throw filterError(undefined, errorDef, { type: typeof val }, typeof val);
    }
    throw new Error(`Expected number but got ${typeof val}`);
  }
  return Math.abs(val);
};

export const round = (val: unknown, precision = 0, method?: 'ceil' | 'floor' | 'round'): number => {
  if (typeof val !== 'number') {
    const errorDef = ERROR_DEFINITIONS.MATH_FILTER;
    if (errorDef) {
      throw filterError(undefined, errorDef, { type: typeof val }, typeof val);
    }
    throw new Error(`Expected number but got ${typeof val}`);
  }
  const factor = 10 ** precision;
  let rounder: (x: number) => number;
  if (method === 'ceil') { rounder = Math.ceil; }
  else if (method === 'floor') { rounder = Math.floor; }
  else { rounder = Math.round; }
  return rounder(val * factor) / factor;
};
