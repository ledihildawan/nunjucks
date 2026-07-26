import {
  TOKEN_BLOCK_START,
  TOKEN_COMMENT,
  TOKEN_DATA,
  TOKEN_VARIABLE_START,
  TOKEN_RAW,
} from '@nunjucks/lexer';
import { nodeList, output, templateData } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import {
  nextToken,
  peekToken,
  advanceAfterVariableEnd,
  fail,
} from "./cursor.ts";
import type { ParserContext } from "./cursor.ts";
import { parseStatement } from "./statement-parser/index.ts";
import { parseExpression } from "./expression-parser/index.ts";

export const parseUntilBlocks = (ctx: ParserContext, ...blockNames: string[]): Node => {
  const prev = ctx.breakOnBlocks;
  ctx.breakOnBlocks = blockNames;

  const ret = nodeList(0, 0, parseNodes(ctx));

  ctx.breakOnBlocks = prev;
  return ret;
};

// Hoisted so each pattern is compiled once rather than on every data token.
const LEADING_WHITESPACE_RE = /^\s*/;
const TRAILING_WHITESPACE_RE = /\s*$/;
const RAW_OPEN_TAG_RE = /^({%\s*raw\s*%})/;
const RAW_CLOSE_TAG_RE = /({%\s*endraw\s*%})$/;

export const parseNodes = (ctx: ParserContext): Node[] => {
  const buf: Node[] = [];

  for (let tok = nextToken(ctx); tok; tok = nextToken(ctx)) {
    if (tok.type === TOKEN_DATA) {
      let data: string = tok.value as string;
      const nextTok = peekToken(ctx);
      const nextVal = nextTok && (nextTok.value as string);

      if (ctx.dropLeadingWhitespace) {
        data = data.replace(LEADING_WHITESPACE_RE, '');
        ctx.dropLeadingWhitespace = false;
      }

      if (nextTok &&
        ((nextTok.type === TOKEN_BLOCK_START &&
        nextVal.at(-1) === '-') ||
        (nextTok.type === TOKEN_VARIABLE_START &&
        nextVal.charAt(ctx.tokens.tags.VARIABLE_START.length) === '-') ||
        (nextTok.type === TOKEN_COMMENT &&
        nextVal.charAt(ctx.tokens.tags.COMMENT_START.length) === '-'))) {
        data = data.replace(TRAILING_WHITESPACE_RE, '');
      }

      buf.push(output(
        tok.lineno,
        tok.colno,
        [templateData(tok.lineno, tok.colno, data)]
      ));
    } else if (tok.type === TOKEN_BLOCK_START) {
      ctx.dropLeadingWhitespace = false;
      const n = parseStatement(ctx);
      if (!n) {
        break;
      }
      buf.push(n);
    } else if (tok.type === TOKEN_VARIABLE_START) {
      const e = parseExpression(ctx);
      ctx.dropLeadingWhitespace = false;
      advanceAfterVariableEnd(ctx);
      buf.push(output(tok.lineno, tok.colno, [e]));
    } else if (tok.type === TOKEN_COMMENT) {
      ctx.dropLeadingWhitespace = (tok.value as string).charAt(
        (tok.value as string).length - ctx.tokens.tags.COMMENT_END.length - 1
      ) === '-';
    } else if (tok.type === TOKEN_RAW) {
      ctx.dropLeadingWhitespace = false;
      let rawContent = tok.value;
      if (typeof rawContent === 'string') {
        rawContent = rawContent
          .replace(RAW_OPEN_TAG_RE, '')
          .replace(RAW_CLOSE_TAG_RE, '');
      }
      buf.push(output(
        tok.lineno,
        tok.colno,
        [templateData(tok.lineno, tok.colno, rawContent as string)]
      ));
    } else {
      fail(ctx, 'Unexpected token at top-level: ' +
        tok.type, tok.lineno, tok.colno);
    }
  }

  return buf;
};
