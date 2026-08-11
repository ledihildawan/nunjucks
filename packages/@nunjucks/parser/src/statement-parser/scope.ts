import { pair, scopeNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { peekToken, skipSymbol, skip, nextToken, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { TOKEN_BLOCK_END, TOKEN_COMMA, TOKEN_OPERATOR } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parsePrimary, parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { loc } from '@nunjucks/shared';

const isBlockEnd = (tok: Token | null | undefined): boolean => tok?.type === TOKEN_BLOCK_END;

const parseScopeAssignment = (parserContext: ParserContext, tag: Token): Result<Node, TemplateError> => {
  const nameSymbolR = parsePrimary(parserContext);
  if (isErr(nameSymbolR)) { return nameSymbolR; }
  const nameSymbol = nameSymbolR.value;
  const eqTokR = peekToken(parserContext);
  if (isErr(eqTokR)) { return eqTokR; }
  const eqTok = eqTokR.value;

  if (!eqTok || eqTok.type !== TOKEN_OPERATOR || eqTok.value !== '=') {
    return fail(parserContext, 'parseScope: expected = after variable name', tag.lineno, tag.colno);
  }

  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) { return consumedR; }
  const valueR = parseExpression(parserContext);
  if (isErr(valueR)) { return valueR; }
  if (!valueR.value) {
    return fail(parserContext, 'parseScope: expected expression after =', tag.lineno, tag.colno);
  }

  return ok(pair(loc(nameSymbol), { key: String(nameSymbol.value), val: valueR.value }));
};

const parseScopeAssignments = (parserContext: ParserContext, tag: Token): Result<Node[], TemplateError> => {
  const assignments: Node[] = [];
  const firstR = parseScopeAssignment(parserContext, tag);
  if (isErr(firstR)) { return firstR; }
  assignments.push(firstR.value);

  const collect = (): Result<Node[], TemplateError> => {
    if (!skip(parserContext, TOKEN_COMMA)) { return ok(assignments); }
    const nextNameTokR = peekToken(parserContext);
    if (isErr(nextNameTokR)) { return nextNameTokR; }
    if (nextNameTokR.value?.type !== 'symbol') {
      return fail(parserContext, 'parseScope: expected variable name after comma', tag.lineno, tag.colno);
    }

    const nextR = parseScopeAssignment(parserContext, tag);
    if (isErr(nextR)) { return nextR; }
    assignments.push(nextR.value);
    return collect();
  };

  return collect();
};

export const parseScope = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'scope')) {
    return fail(parserContext, 'parseScope: expected scope', tag.lineno, tag.colno);
  }

  const firstTokR = peekToken(parserContext);
  if (isErr(firstTokR)) { return firstTokR; }
  const firstTok = firstTokR.value;

  let assignments: Node[] = [];
  if (isBlockEnd(firstTok)) {
    const aR = advanceAfterBlockEnd(parserContext, 'scope');
    if (isErr(aR)) { return aR; }
  } else if (firstTok?.type === 'symbol') {
    const assignmentsR = parseScopeAssignments(parserContext, tag);
    if (isErr(assignmentsR)) { return assignmentsR; }
    assignments = assignmentsR.value;
    const aR = advanceAfterBlockEnd(parserContext, 'scope');
    if (isErr(aR)) { return aR; }
  } else {
    return fail(parserContext, 'parseScope: expected variable name or block end', tag.lineno, tag.colno);
  }

  const bodyR = parseUntilBlocks(parserContext, 'endscope');
  if (isErr(bodyR)) { return bodyR; }

  if (!skipSymbol(parserContext, 'endscope')) {
    return fail(parserContext, 'parseScope: expected endscope', tag.lineno, tag.colno);
  }

  const finalR = advanceAfterBlockEnd(parserContext, 'endscope');
  if (isErr(finalR)) { return finalR; }

  return ok(scopeNode(loc(tag), { assignments, body: bodyR.value }));
};
