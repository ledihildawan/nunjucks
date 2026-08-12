import type { Response, NextFunction } from 'express';
import { ok, err, type Result } from '@nunjucks/lib';

type InvalidTemplate = string & { readonly __brand: unique symbol };

const createInvalidTemplate = (value: unknown): Result<InvalidTemplate, Error> => {
  if (typeof value !== 'string' || value === null) {
    const errObj = new Error(`Invalid value for 'template'`) as Error & { code?: string };
    errObj.code = 'VALIDATION_ERROR';
    return err(errObj);
  }
  return ok(String(value) as InvalidTemplate);
};

const isError = (value: unknown): value is Error => value instanceof Error;

const handleError = (value: unknown): Error => {
  if (isError(value)) { return value; }
  return new Error(String(value));
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const sendResult = (
  res: Response,
  next: NextFunction,
  result: Result<string, Error>,
): void => {
  if (result.ok) {
    res.type('html').send(result.value);
    return;
  }
  next(result.error);
};

export { createInvalidTemplate, isError, handleError, escapeHtml, sendResult };
export type { InvalidTemplate };