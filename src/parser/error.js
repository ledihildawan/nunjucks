import { createLog } from '@nunjucks/log';
import { peekToken } from './cursor.js';

export const error = (ctx, msg, lineno, colno) => {
  if (lineno === undefined || colno === undefined) {
    const tok = peekToken(ctx) || {};
    lineno = tok.lineno;
    colno = tok.colno;
  }
  return createLog('error', {
    name: 'PARSER_ERROR',
    message: () => msg,
    pattern: /./
  }, {}, null, { lineno, colno, phase: 'parse', lineBase: 'zero' });
};

export const fail = (ctx, msg, lineno, colno) => {
  throw error(ctx, msg, lineno, colno);
};
