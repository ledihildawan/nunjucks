import type { Result } from '@nunjucks/lib';
import type { NextFunction, Response } from 'express';

interface SendTemplateResultOptions {
  res: Response;
  next: NextFunction;
  result: Result<string, Error>;
}

// WHY: Express Shell sends the HTML value or hands the error to the error middleware — never serializes the Result wrapper.
const sendTemplateResult = ({ res, next, result }: SendTemplateResultOptions): void => {
  if (result.ok) {
    res.type('html').send(result.value);
    return;
  }
  next(result.error);
};

export { sendTemplateResult };
