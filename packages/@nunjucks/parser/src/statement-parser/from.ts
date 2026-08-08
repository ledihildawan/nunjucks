import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
  isSymbolToken,
} from '@nunjucks/lexer';
import { appendChild, fromImportNode, nodeList, pair } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { nextToken, peekToken, skip, skipSymbol, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parseExpression, parsePrimary } from "../expression-parser/index.ts";
import { parseWithContext } from "./import-context.ts";
import { loc } from '@nunjucks/shared';

const isUnderscore = (name: Node): boolean => {
  if (typeof name.value === 'string' && name.value[0] === '_') {
    return true;
  }
  return false;
};

const parseImportName = (
  parserContext: ParserContext,
  names: ChildrenNode
): Result<{ names: ChildrenNode; withContext: boolean | null | undefined }, TemplateError> => {
  const nameR = parsePrimary(parserContext);
  if (isErr(nameR)) { return nameR; }
  const name = nameR.value;
  if (isUnderscore(name)) {
    return fail(parserContext, 'parseFrom: names starting with an underscore cannot be imported',
      name.lineno,
      name.colno);
  }

  const hasAlias = skipSymbol(parserContext, 'as');
  let newNames: ChildrenNode;
  if (hasAlias) {
    const aliasR = parsePrimary(parserContext);
    if (isErr(aliasR)) { return aliasR; }
    newNames = appendChild(names, pair(loc(name), { key: name, val: aliasR.value }));
  } else {
    newNames = appendChild(names, name);
  }

  const withContextR = parseWithContext(parserContext);
  if (isErr(withContextR)) { return withContextR; }
  return ok({ names: newNames, withContext: withContextR.value });
};

const handleBlockEnd = (
  parserContext: ParserContext,
  names: ChildrenNode,
  fromTok: Token
): Result<void, TemplateError> => {
  if (names.children.length === 0) {
    return fail(parserContext, 'parseFrom: Expected at least one import name',
      fromTok.lineno,
      fromTok.colno);
  }

  const nextTokR = peekToken(parserContext);
  if (isErr(nextTokR)) { return nextTokR; }
  if (isSymbolToken(nextTokR.value) && nextTokR.value.value[0] === '-') {
    parserContext.dropLeadingWhitespace = true;
  }

  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) { return consumedR; }
  return ok(undefined);
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Result unwrap-and-return short-circuits inflate branching
export const parseFrom = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const fromTokR = peekToken(parserContext);
  if (isErr(fromTokR)) { return fromTokR; }
  const fromTok = fromTokR.value;
  if (!skipSymbol(parserContext, 'from')) {
    return fail(parserContext, 'parseFrom: expected from');
  }

  const templateR = parseExpression(parserContext);
  if (isErr(templateR)) { return templateR; }

  if (!skipSymbol(parserContext, 'import')) {
    return fail(parserContext, 'parseFrom: expected import',
      fromTok.lineno,
      fromTok.colno);
  }

  let names: ChildrenNode = nodeList(loc(fromTok));
  let withContext: boolean | null | undefined;

  for (;;) {
    const nextTokR = peekToken(parserContext);
    if (isErr(nextTokR)) { return nextTokR; }
    if (nextTokR.value.type === TOKEN_BLOCK_END) {
      const endR = handleBlockEnd(parserContext, names, fromTok);
      if (isErr(endR)) { return endR; }
      break;
    }

    if (names.children.length > 0 && !skip(parserContext, TOKEN_COMMA)) {
      return fail(parserContext, 'parseFrom: expected comma',
        fromTok.lineno,
        fromTok.colno);
    }

    const result = parseImportName(parserContext, names);
    if (isErr(result)) { return result; }
    names = result.value.names;
    withContext = result.value.withContext;
  }

  return ok(fromImportNode(loc(fromTok), {
    template: templateR.value,
    names,
    withContext: withContext ?? false,
  }));
};
