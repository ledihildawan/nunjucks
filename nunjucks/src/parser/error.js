import * as lexer from '../lexer/index.js';
import { TemplateError } from '../error/index.js';
import { peekToken } from './cursor.js';

export const error = (ctx, msg, lineno, colno) => {
  if (lineno === undefined || colno === undefined) {
    const tok = peekToken(ctx) || {};
    lineno = tok.lineno;
    colno = tok.colno;
  }
  return new TemplateError(msg, lineno, colno, { phase: 'parse' });
};

export const fail = (ctx, msg, lineno, colno) => {
  throw error(ctx, msg, lineno, colno);
};
