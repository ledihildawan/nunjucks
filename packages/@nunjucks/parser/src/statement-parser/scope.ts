import { pair, scopeNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, skip, nextToken, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { TOKEN_BLOCK_END, TOKEN_COMMA, TOKEN_OPERATOR } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { parsePrimary, parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { loc } from '@nunjucks/shared';

const isBlockEnd = (tok: Token | null | undefined): boolean => tok?.type === TOKEN_BLOCK_END;

const parseScopeAssignment = (parserContext: ParserContext, tag: Token): Node => {
  const nameSymbol = parsePrimary(parserContext);
  const eqTok = peekToken(parserContext);

  if (!eqTok || eqTok.type !== TOKEN_OPERATOR || eqTok.value !== '=') {
    fail(parserContext, 'parseScope: expected = after variable name', tag.lineno, tag.colno);
  }

  nextToken(parserContext);
  const value = parseExpression(parserContext);
  if (!value) {
    fail(parserContext, 'parseScope: expected expression after =', tag.lineno, tag.colno);
  }

  return pair(loc(nameSymbol), String(nameSymbol.value), value);
};

const parseScopeAssignments = (parserContext: ParserContext, tag: Token): Node[] => {
  const assignments: Node[] = [];
  assignments.push(parseScopeAssignment(parserContext, tag));

  while (skip(parserContext, TOKEN_COMMA)) {
    const nextNameTok = peekToken(parserContext);
    if (nextNameTok?.type !== 'symbol') {
      fail(parserContext, 'parseScope: expected variable name after comma', tag.lineno, tag.colno);
    }

    const nextName = parsePrimary(parserContext);
    const nextEq = peekToken(parserContext);
    if (!nextEq || nextEq.type !== TOKEN_OPERATOR || nextEq.value !== '=') {
      fail(parserContext, 'parseScope: expected = after variable name', tag.lineno, tag.colno);
    }

    nextToken(parserContext);
    const nextValue = parseExpression(parserContext);
    if (!nextValue) {
      fail(parserContext, 'parseScope: expected expression after =', tag.lineno, tag.colno);
    }

    assignments.push(pair(loc(nextName), String(nextName.value), nextValue));
  }

  return assignments;
};

export const parseScope = (parserContext: ParserContext): Node => {
  const tag = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'scope')) {
    fail(parserContext, 'parseScope: expected scope', tag.lineno, tag.colno);
  }

  const firstTok = peekToken(parserContext);

  let assignments: Node[] = [];
  if (isBlockEnd(firstTok)) {
    advanceAfterBlockEnd(parserContext, 'scope');
  } else if (firstTok?.type === 'symbol') {
    assignments = parseScopeAssignments(parserContext, tag);
    advanceAfterBlockEnd(parserContext, 'scope');
  } else {
    fail(parserContext, 'parseScope: expected variable name or block end', tag.lineno, tag.colno);
  }

  const body = parseUntilBlocks(parserContext, 'endscope');

  if (!skipSymbol(parserContext, 'endscope')) {
    fail(parserContext, 'parseScope: expected endscope', tag.lineno, tag.colno);
  }

  advanceAfterBlockEnd(parserContext, 'endscope');

  return scopeNode(loc(tag), assignments, body);
};
