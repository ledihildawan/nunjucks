import { pair, scope_ } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, skip, nextToken, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { TOKEN_BLOCK_END, TOKEN_COMMA, TOKEN_OPERATOR } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { parsePrimary, parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";

const isBlockEnd = (tok: Token | null | undefined): boolean => tok?.type === TOKEN_BLOCK_END;

const parseScopeAssignment = (ctx: ParserContext, tag: Token): Node => {
  const nameSymbol = parsePrimary(ctx);
  const eqTok = peekToken(ctx);

  if (!eqTok || eqTok.type !== TOKEN_OPERATOR || eqTok.value !== '=') {
    fail(ctx, 'parseScope: expected = after variable name', tag.lineno, tag.colno);
  }

  nextToken(ctx);
  const value = parseExpression(ctx);
  if (!value) {
    fail(ctx, 'parseScope: expected expression after =', tag.lineno, tag.colno);
  }

  return pair(nameSymbol.lineno, nameSymbol.colno, String(nameSymbol.value), value);
};

const parseScopeAssignments = (ctx: ParserContext, tag: Token): Node[] => {
  const assignments: Node[] = [];
  assignments.push(parseScopeAssignment(ctx, tag));

  while (skip(ctx, TOKEN_COMMA)) {
    const nextNameTok = peekToken(ctx);
    if (nextNameTok?.type !== 'symbol') {
      fail(ctx, 'parseScope: expected variable name after comma', tag.lineno, tag.colno);
    }

    const nextName = parsePrimary(ctx);
    const nextEq = peekToken(ctx);
    if (!nextEq || nextEq.type !== TOKEN_OPERATOR || nextEq.value !== '=') {
      fail(ctx, 'parseScope: expected = after variable name', tag.lineno, tag.colno);
    }

    nextToken(ctx);
    const nextValue = parseExpression(ctx);
    if (!nextValue) {
      fail(ctx, 'parseScope: expected expression after =', tag.lineno, tag.colno);
    }

    assignments.push(pair(nextName.lineno, nextName.colno, String(nextName.value), nextValue));
  }

  return assignments;
};

export const parseScope = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'scope')) {
    fail(ctx, 'parseScope: expected scope', tag.lineno, tag.colno);
  }

  const firstTok = peekToken(ctx);

  let assignments: Node[] = [];
  if (isBlockEnd(firstTok)) {
    advanceAfterBlockEnd(ctx, 'scope');
  } else if (firstTok?.type === 'symbol') {
    assignments = parseScopeAssignments(ctx, tag);
    advanceAfterBlockEnd(ctx, 'scope');
  } else {
    fail(ctx, 'parseScope: expected variable name or block end', tag.lineno, tag.colno);
  }

  const body = parseUntilBlocks(ctx, 'endscope');

  if (!skipSymbol(ctx, 'endscope')) {
    fail(ctx, 'parseScope: expected endscope', tag.lineno, tag.colno);
  }

  advanceAfterBlockEnd(ctx, 'endscope');

  return scope_(tag.lineno, tag.colno, assignments, body);
};
