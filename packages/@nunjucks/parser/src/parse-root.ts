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

const parseUntilBlocks = (parserContext: ParserContext, ...blockNames: string[]): Node => {
  return nodeList(0, 0, parseNodes(parserContext, blockNames));
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
    return nextVal.charAt(parserContext.tokens.tags.variableStart.length) === '-';
  }
  if (nextTok.type === TOKEN_COMMENT) {
    return nextVal.charAt(parserContext.tokens.tags.commentStart.length) === '-';
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
    tok.lineno,
    tok.colno,
    [templateData(tok.lineno, tok.colno, data)]
  ));
};

const parseRawToken = (tok: Token & { type: 'raw' }, buf: Node[]): void => {
  const content = pipe(tok.value, replace(RAW_OPEN_TAG_RE, ''), replace(RAW_CLOSE_TAG_RE, ''));
  buf.push(output(
    tok.lineno,
    tok.colno,
    [templateData(tok.lineno, tok.colno, content)]
  ));
};

const parseVariableToken = (parserContext: ParserContext, tok: Token, buf: Node[]): void => {
  const e = parseExpression(parserContext);
  advanceAfterVariableEnd(parserContext);
  buf.push(output(tok.lineno, tok.colno, [e]));
};

const parseCommentToken = (parserContext: ParserContext, tok: Token): void => {
  const tokVal = String(tok.value);
  parserContext.dropLeadingWhitespace = tokVal.charAt(
    tokVal.length - parserContext.tokens.tags.commentEnd.length - 1
  ) === '-';
};

const handleToken = (parserContext: ParserContext, tok: Token, buf: Node[], breakOn: readonly string[] | null = null): boolean => {
  const wsDrop = consumeWhitespaceDrop(parserContext);

  if (tok.type === TOKEN_DATA) {
    parseDataToken(parserContext, tok, buf, wsDrop);
    return true;
  }
  if (tok.type === TOKEN_BLOCK_START) {
    const n = parseStatement(parserContext, breakOn);
    if (!n) {
      return false;
    }
    buf.push(n);
    return true;
  }
  if (tok.type === TOKEN_VARIABLE_START) {
    parseVariableToken(parserContext, tok, buf);
    return true;
  }
  if (tok.type === TOKEN_COMMENT) {
    parseCommentToken(parserContext, tok);
    return true;
  }
  if (tok.type === TOKEN_RAW) {
    parseRawToken(tok, buf);
    return true;
  }
  fail(parserContext, `Unexpected token at top-level: ${tok.type}`, tok.lineno, tok.colno);
  return true;
};

const parseNodes = (parserContext: ParserContext, breakOn: readonly string[] | null = null): Node[] => {
  const buf: Node[] = [];

  for (let tok = nextTokenOrNull(parserContext); tok; tok = nextTokenOrNull(parserContext)) {
    if (!handleToken(parserContext, tok, buf, breakOn)) {
      break;
    }
  }

  return buf;
};

export { parseUntilBlocks, parseNodes };
