import {
  TOKEN_BLOCK_START,
  TOKEN_COMMENT,
  TOKEN_DATA,
  TOKEN_VARIABLE_START,
} from '../lexer/token-types.js';
import { Output, TemplateData } from '../nodes/index.js';
import {
  nextToken,
  peekToken,
  advanceAfterVariableEnd,
  fail,
} from './cursor.js';

export const parseUntilBlocks = (ctx, ...blockNames) => {
  const prev = ctx.breakOnBlocks;
  ctx.breakOnBlocks = blockNames;

  const ret = ctx.parse();

  ctx.breakOnBlocks = prev;
  return ret;
};

export const parseNodes = (ctx) => {
  let tok;
  const buf = [];

  while ((tok = nextToken(ctx))) {
    if (tok.type === TOKEN_DATA) {
      let data = tok.value;
      const nextToken = peekToken(ctx);
      const nextVal = nextToken && nextToken.value;

      if (ctx.dropLeadingWhitespace) {
        data = data.replace(/^\s*/, '');
        ctx.dropLeadingWhitespace = false;
      }

      if (nextToken &&
        ((nextToken.type === TOKEN_BLOCK_START &&
        nextVal.charAt(nextVal.length - 1) === '-') ||
        (nextToken.type === TOKEN_VARIABLE_START &&
        nextVal.charAt(ctx.tokens.tags.VARIABLE_START.length) === '-') ||
        (nextToken.type === TOKEN_COMMENT &&
        nextVal.charAt(ctx.tokens.tags.COMMENT_START.length) === '-'))) {
        data = data.replace(/\s*$/, '');
      }

      buf.push(Output(
        tok.lineno,
        tok.colno,
        [TemplateData(tok.lineno, tok.colno, data)]
      ));
    } else if (tok.type === TOKEN_BLOCK_START) {
      ctx.dropLeadingWhitespace = false;
      const n = ctx.parseStatement();
      if (!n) {
        break;
      }
      buf.push(n);
    } else if (tok.type === TOKEN_VARIABLE_START) {
      const e = ctx.parseExpression();
      ctx.dropLeadingWhitespace = false;
      advanceAfterVariableEnd(ctx);
      buf.push(Output(tok.lineno, tok.colno, [e]));
    } else if (tok.type === TOKEN_COMMENT) {
      ctx.dropLeadingWhitespace = tok.value.charAt(
        tok.value.length - ctx.tokens.tags.COMMENT_END.length - 1
      ) === '-';
    } else {
      fail(ctx, 'Unexpected token at top-level: ' +
        tok.type, tok.lineno, tok.colno);
    }
  }

  return buf;
};
