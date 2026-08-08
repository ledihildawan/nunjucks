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
import type { TemplateError } from '@nunjucks/log';
import { pipe } from 'remeda';
import { replace, loc, ZERO_LOC, ok, isErr, type Result } from '@nunjucks/shared';
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

const parseUntilBlocks = (parserContext: ParserContext, ...blockNames: string[]): Result<Node, TemplateError> => {
  const nodesR = parseNodes(parserContext, blockNames);
  if (isErr(nodesR)) { return nodesR; }
  return ok(nodeList(ZERO_LOC, nodesR.value));
};

const LEADING_WHITESPACE_RE = /^\s*/;
const TRAILING_WHITESPACE_RE = /\s*$/;
const RAW_OPEN_TAG_RE = /^({%\s*raw\s*%})/;
const RAW_CLOSE_TAG_RE = /({%\s*endraw\s*%})$/;

const shouldStripTrailingWhitespace = (
  nextTok: Token,
  parserContext: ParserContext
): boolean => {
  if (!nextTok) { return false; }
  const nextVal = String(nextTok.value);
  if (nextTok.type === TOKEN_BLOCK_START) {
    return nextVal.at(-1) === '-';
  }
  if (nextTok.type === TOKEN_VARIABLE_START) {
    return nextVal[parserContext.tokens.tags.variableStart.length] === '-';
  }
  if (nextTok.type === TOKEN_COMMENT) {
    return nextVal[parserContext.tokens.tags.commentStart.length] === '-';
  }
  return false;
};

const parseDataToken = (parserContext: ParserContext, tok: Token, buf: Node[], stripLeading: boolean): void => {
  const nextTok = peekTokenOrNull(parserContext);
  const stripTrailing = Boolean(nextTok && shouldStripTrailingWhitespace(nextTok, parserContext));
  const data = pipe(
    String(tok.value),
    s => (stripLeading ? s.replace(LEADING_WHITESPACE_RE, '') : s),
    s => (stripTrailing ? s.replace(TRAILING_WHITESPACE_RE, '') : s),
  );

  buf.push(output(
    loc(tok),
    [templateData(loc(tok), data)]
  ));
};

const parseRawToken = (tok: Token & { type: 'raw' }, buf: Node[]): void => {
  const content = pipe(tok.value, replace(RAW_OPEN_TAG_RE, ''), replace(RAW_CLOSE_TAG_RE, ''));
  buf.push(output(
    loc(tok),
    [templateData(loc(tok), content)]
  ));
};

const parseVariableToken = (parserContext: ParserContext, tok: Token, buf: Node[]): Result<void, TemplateError> => {
  const exprR = parseExpression(parserContext);
  if (isErr(exprR)) { return exprR; }
  const endR = advanceAfterVariableEnd(parserContext);
  if (isErr(endR)) { return endR; }
  buf.push(output(loc(tok), [exprR.value]));
  return ok(undefined);
};

const parseCommentToken = (parserContext: ParserContext, tok: Token): void => {
  const tokVal = String(tok.value);
  parserContext.dropLeadingWhitespace = tokVal.at(
    tokVal.length - parserContext.tokens.tags.commentEnd.length - 1
  ) === '-';
};

const handleToken = (parserContext: ParserContext, tok: Token, buf: Node[], breakOn: readonly string[] | null = null): Result<boolean, TemplateError> => {
  const wsDrop = consumeWhitespaceDrop(parserContext);

  if (tok.type === TOKEN_DATA) {
    parseDataToken(parserContext, tok, buf, wsDrop);
    return ok(true);
  }
  if (tok.type === TOKEN_BLOCK_START) {
    const nR = parseStatement(parserContext, breakOn);
    if (isErr(nR)) { return nR; }
    const n = nR.value;
    if (!n) {
      return ok(false);
    }
    buf.push(n);
    return ok(true);
  }
  if (tok.type === TOKEN_VARIABLE_START) {
    const r = parseVariableToken(parserContext, tok, buf);
    if (isErr(r)) { return r; }
    return ok(true);
  }
  if (tok.type === TOKEN_COMMENT) {
    parseCommentToken(parserContext, tok);
    return ok(true);
  }
  if (tok.type === TOKEN_RAW) {
    parseRawToken(tok, buf);
    return ok(true);
  }
  return fail(parserContext, `Unexpected token at top-level: ${tok.type}`, tok.lineno, tok.colno);
};

const parseNodes = (parserContext: ParserContext, breakOn: readonly string[] | null = null): Result<Node[], TemplateError> => {
  const buf: Node[] = [];

  for (let tok = nextTokenOrNull(parserContext); tok; tok = nextTokenOrNull(parserContext)) {
    const continueR = handleToken(parserContext, tok, buf, breakOn);
    if (isErr(continueR)) { return continueR; }
    if (!continueR.value) {
      break;
    }
  }

  return ok(buf);
};

export { parseUntilBlocks, parseNodes };
