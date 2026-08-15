import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { err, ok, type Result } from '@nunjucks/lib';
import { requireNumberError } from '../factory/index.ts';

export const abs = (value: unknown): Result<number, TemplateError> => {
  if (typeof value !== 'number') {
    return err(requireNumberError(value, ERROR_DEFINITIONS.MATH_FILTER));
  }
  return ok(Math.abs(value));
};

export const round = (
  value: unknown,
  precision = 0,
  method?: 'ceil' | 'floor' | 'round'
): Result<number, TemplateError> => {
  if (typeof value !== 'number') {
    return err(requireNumberError(value, ERROR_DEFINITIONS.MATH_FILTER));
  }
  const factor = 10 ** precision;
  const rounder = method === 'ceil' ? Math.ceil : method === 'floor' ? Math.floor : Math.round;
  return ok(rounder(value * factor) / factor);
};
