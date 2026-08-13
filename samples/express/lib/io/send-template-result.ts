import type { NextFunction, Response } from 'express';
import type { Result } from '@nunjucks/lib';

// WHY: Express Shell sends the HTML value or hands the error to the error middleware — never serializes the Result wrapper.
const sendTemplateResult = (
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

export { sendTemplateResult };
