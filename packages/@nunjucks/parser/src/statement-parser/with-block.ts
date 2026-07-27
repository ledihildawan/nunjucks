import { pair, with_ } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, skip, nextToken, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { TOKEN_BLOCK_END, TOKEN_COMMA, TOKEN_OPERATOR } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { parsePrimary } from "../expression-parser/primary.ts";
import { parseExpression } from "../expression-parser/inline.ts";
import { parseUntilBlocks } from "../top-level.ts";

const isBlockEnd = (tok: Token | null | undefined): boolean => tok !== null && tok !== undefined && tok.type === TOKEN_BLOCK_END;

const parseWithAssignment = (ctx: ParserContext, tag: ReturnType<typeof peekToken>): Node => {
  const nameSymbol = parsePrimary(ctx);
  const eqTok = peekToken(ctx);

  if (!eqTok || eqTok.type !== TOKEN_OPERATOR || eqTok.value !== '=') {
    fail(ctx, 'parseWith: expected = after variable name', tag.lineno, tag.colno);
  }

  nextToken(ctx);
  const value = parseExpression(ctx);
  if (!value) {
    fail(ctx, 'parseWith: expected expression after =', tag.lineno, tag.colno);
  }

  return pair(nameSymbol.lineno, nameSymbol.colno, nameSymbol.value as Node, value);
};

const parseWithAssignments = (ctx: ParserContext, tag: ReturnType<typeof peekToken>): Node[] => {
  const assignments: Node[] = [];
  assignments.push(parseWithAssignment(ctx, tag));

  while (skip(ctx, TOKEN_COMMA)) {
    const nextNameTok = peekToken(ctx);
    if (nextNameTok?.type !== 'symbol') {
      fail(ctx, 'parseWith: expected variable name after comma', tag.lineno, tag.colno);
    }

    const nextName = parsePrimary(ctx);
    const nextEq = peekToken(ctx);
    if (!nextEq || nextEq.type !== TOKEN_OPERATOR || nextEq.value !== '=') {
      fail(ctx, 'parseWith: expected = after variable name', tag.lineno, tag.colno);
    }

    nextToken(ctx);
    const nextValue = parseExpression(ctx);
    if (!nextValue) {
      fail(ctx, 'parseWith: expected expression after =', tag.lineno, tag.colno);
    }

    assignments.push(pair(nextName.lineno, nextName.colno, nextName.value as Node, nextValue));
  }

  return assignments;
};

export const parseWith = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'with')) {
    fail(ctx, 'parseWith: expected with', tag.lineno, tag.colno);
  }

  const firstTok = peekToken(ctx);

  let assignments: Node[] = [];
  if (isBlockEnd(firstTok)) {
    advanceAfterBlockEnd(ctx, 'with');
  } else if (firstTok && firstTok.type === 'symbol') {
    assignments = parseWithAssignments(ctx, tag);
    advanceAfterBlockEnd(ctx, 'with');
  } else {
    fail(ctx, 'parseWith: expected variable name or block end', tag.lineno, tag.colno);
  }

  const body = parseUntilBlocks(ctx, 'endwith');

  if (!skipSymbol(ctx, 'endwith')) {
    fail(ctx, 'parseWith: expected endwith', tag.lineno, tag.colno);
  }

  advanceAfterBlockEnd(ctx, 'endwith');

  return with_(tag.lineno, tag.colno, assignments, body);
};
