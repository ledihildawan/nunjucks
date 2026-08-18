import type { Result } from '@nunjucks/lib';
import type { NextFunction, Response } from 'express';

interface SendTemplateResultOptions {
  res: Response;
  next: NextFunction;
  result: Result<string, Error>;
}

/**
 * Express shell adapter for render `Result`s — sends the HTML value on success or
 * hands the error to the central error middleware. Never serializes the `Result`
 * wrapper itself into the response.
 *
 * @param options - Express response, `next` for the error path, and the render result.
 */
const sendTemplateResult = ({ res, next, result }: SendTemplateResultOptions): void => {
  if (result.ok) {
    res.type('html').send(result.value);
    return;
  }
  next(result.error);
};

export { sendTemplateResult };
