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
import {
  nextToken,
  peekToken,
  advanceAfterVariableEnd,
  fail,
} from "./cursor.ts";
import type { ParserContext } from "./cursor.ts";
import { parseStatement } from "./statement-parser/index.ts";
import { parseExpression } from "./expression-parser/inline.ts";

const parseUntilBlocks = (ctx: ParserContext, ...blockNames: string[]): Node => {
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

const shouldStripTrailingWhitespace = (
  nextTok: ReturnType<typeof peekToken>,
  ctx: ParserContext
): boolean => {
  if (!nextTok) { return false; }
  const nextVal = nextTok.value as string;
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

const parseDataToken = (ctx: ParserContext, tok: ReturnType<typeof nextToken>, buf: Node[]): void => {
  const nextTok = peekToken(ctx);
  const stripLeading = ctx.dropLeadingWhitespace;
  const stripTrailing = Boolean(nextTok && shouldStripTrailingWhitespace(nextTok, ctx));
  if (stripLeading) {
    ctx.dropLeadingWhitespace = false;
  }
  const data = pipe(
    tok.value as string,
    s => (stripLeading ? s.replace(LEADING_WHITESPACE_RE, '') : s),
    s => (stripTrailing ? s.replace(TRAILING_WHITESPACE_RE, '') : s),
  );

  buf.push(output(
    tok.lineno,
    tok.colno,
    [templateData(tok.lineno, tok.colno, data)]
  ));
};

const parseRawToken = (tok: ReturnType<typeof nextToken>, buf: Node[]): void => {
  const rawContent = tok.value;
  const content = typeof rawContent === 'string'
    ? pipe(rawContent, s => s.replace(RAW_OPEN_TAG_RE, ''), s => s.replace(RAW_CLOSE_TAG_RE, ''))
    : rawContent;
  buf.push(output(
    tok.lineno,
    tok.colno,
    [templateData(tok.lineno, tok.colno, content as string)]
  ));
};

const parseVariableToken = (ctx: ParserContext, tok: ReturnType<typeof nextToken>, buf: Node[]): void => {
  const e = parseExpression(ctx);
  ctx.dropLeadingWhitespace = false;
  advanceAfterVariableEnd(ctx);
  buf.push(output(tok.lineno, tok.colno, [e]));
};

const parseCommentToken = (ctx: ParserContext, tok: ReturnType<typeof nextToken>): void => {
  ctx.dropLeadingWhitespace = (tok.value as string).charAt(
    (tok.value as string).length - ctx.tokens.tags.COMMENT_END.length - 1
  ) === '-';
};

const handleToken = (ctx: ParserContext, tok: ReturnType<typeof nextToken>, buf: Node[]): boolean => {
  if (tok.type === TOKEN_DATA) {
    parseDataToken(ctx, tok, buf);
    return true;
  }
  if (tok.type === TOKEN_BLOCK_START) {
    ctx.dropLeadingWhitespace = false;
    const n = parseStatement(ctx);
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
    ctx.dropLeadingWhitespace = false;
    parseRawToken(tok, buf);
    return true;
  }
  fail(ctx, `Unexpected token at top-level: ${tok.type}`, tok.lineno, tok.colno);
  return true;
};

const parseNodes = (ctx: ParserContext): Node[] => {
  const buf: Node[] = [];

  for (let tok = nextToken(ctx); tok; tok = nextToken(ctx)) {
    if (!handleToken(ctx, tok, buf)) {
      break;
    }
  }

  return buf;
};

export { parseUntilBlocks, parseNodes };
