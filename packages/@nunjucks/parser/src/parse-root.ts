import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_BLOCK_START,
  TOKEN_COMMENT,
  TOKEN_DATA,
  TOKEN_VARIABLE_START,
  TOKEN_RAW,
} from '@nunjucks/lexer';
import { nodeList, output, templateData } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { pipe } from 'remeda';
import { replace } from '@nunjucks/shared';
import {
  nextTokenOrNull,
  peekTokenOrNull,
  advanceAfterVariableEnd,
  consumeWhitespaceDrop,
  fail,
} from "./cursor.ts";
import type { ParserContext } from "./cursor.ts";
import { parseStatement } from "./statement-parser/index.ts";
import { parseExpression } from "./expression-parser/index.ts";

const parseUntilBlocks = (ctx: ParserContext, ...blockNames: string[]): Node => {
  return nodeList(0, 0, parseNodes(ctx, blockNames));
};

// Hoisted so each pattern is compiled once rather than on every data token.
const LEADING_WHITESPACE_RE = /^\s*/;
const TRAILING_WHITESPACE_RE = /\s*$/;
const RAW_OPEN_TAG_RE = /^({%\s*raw\s*%})/;
const RAW_CLOSE_TAG_RE = /({%\s*endraw\s*%})$/;

const shouldStripTrailingWhitespace = (
  nextTok: Token,
  ctx: ParserContext
): boolean => {
  if (!nextTok) { return false; }
  const nextVal = String(nextTok.value);
  if (nextTok.type === TOKEN_BLOCK_START) {
    return nextVal.at(-1) === '-';
  }
  if (nextTok.type === TOKEN_VARIABLE_START) {
    return nextVal.charAt(ctx.tokens.tags.VARIABLE_START.length) === '-';
  }
  if (nextTok.type === TOKEN_COMMENT) {
    return nextVal.charAt(ctx.tokens.tags.COMMENT_START.length) === '-';
  }
  return false;
};

const parseDataToken = (ctx: ParserContext, tok: Token, buf: Node[], stripLeading: boolean): void => {
  const nextTok = peekTokenOrNull(ctx);
  const stripTrailing = Boolean(nextTok && shouldStripTrailingWhitespace(nextTok, ctx));
  const data = pipe(
    String(tok.value),
    s => (stripLeading ? s.replace(LEADING_WHITESPACE_RE, '') : s),
    s => (stripTrailing ? s.replace(TRAILING_WHITESPACE_RE, '') : s),
  );

  buf.push(output(
    tok.lineno,
    tok.colno,
    [templateData(tok.lineno, tok.colno, data)]
  ));
};

const parseRawToken = (tok: Token, buf: Node[]): void => {
  const rawContent = tok.value;
  const content = typeof rawContent === 'string'
    ? pipe(rawContent, replace(RAW_OPEN_TAG_RE, ''), replace(RAW_CLOSE_TAG_RE, ''))
    : rawContent;
  buf.push(output(
    tok.lineno,
    tok.colno,
    [templateData(tok.lineno, tok.colno, content as string)]
  ));
};

const parseVariableToken = (ctx: ParserContext, tok: Token, buf: Node[]): void => {
  const e = parseExpression(ctx);
  advanceAfterVariableEnd(ctx);
  buf.push(output(tok.lineno, tok.colno, [e]));
};

const parseCommentToken = (ctx: ParserContext, tok: Token): void => {
  const tokVal = String(tok.value);
  ctx.dropLeadingWhitespace = tokVal.charAt(
    tokVal.length - ctx.tokens.tags.COMMENT_END.length - 1
  ) === '-';
};

const handleToken = (ctx: ParserContext, tok: Token, buf: Node[], breakOn: readonly string[] | null = null): boolean => {
  const wsDrop = consumeWhitespaceDrop(ctx);

  if (tok.type === TOKEN_DATA) {
    parseDataToken(ctx, tok, buf, wsDrop);
    return true;
  }
  if (tok.type === TOKEN_BLOCK_START) {
    const n = parseStatement(ctx, breakOn);
    if (!n) {
      return false;
    }
    buf.push(n);
    return true;
  }
  if (tok.type === TOKEN_VARIABLE_START) {
    parseVariableToken(ctx, tok, buf);
    return true;
  }
  if (tok.type === TOKEN_COMMENT) {
    parseCommentToken(ctx, tok);
    return true;
  }
  if (tok.type === TOKEN_RAW) {
    parseRawToken(tok, buf);
    return true;
  }
  fail(ctx, `Unexpected token at top-level: ${tok.type}`, tok.lineno, tok.colno);
  return true;
};

const parseNodes = (ctx: ParserContext, breakOn: readonly string[] | null = null): Node[] => {
  const buf: Node[] = [];

  for (let tok = nextTokenOrNull(ctx); tok; tok = nextTokenOrNull(ctx)) {
    if (!handleToken(ctx, tok, buf, breakOn)) {
      break;
    }
  }

  return buf;
};

export { parseUntilBlocks, parseNodes };
