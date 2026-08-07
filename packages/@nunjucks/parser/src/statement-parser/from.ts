import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
  isSymbolToken,
} from '@nunjucks/lexer';
import { appendChild, fromImportNode, nodeList, pair } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { nextToken, peekToken, skip, skipSymbol, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression, parsePrimary } from "../expression-parser/index.ts";
import { parseWithContext } from "./import-context.ts";

const isUnderscore = (name: Node): boolean => {
  if (typeof name.value === 'string' && name.value.charAt(0) === '_') {
    return true;
  }
  return false;
};

const parseImportName = (
  parserContext: ParserContext,
  names: ChildrenNode
): { names: ChildrenNode; withContext: boolean | null | undefined } => {
  const name = parsePrimary(parserContext);
  if (isUnderscore(name)) {
    fail(parserContext, 'parseFrom: names starting with an underscore cannot be imported',
      name.lineno,
      name.colno);
  }

  const hasAlias = skipSymbol(parserContext, 'as');
  const newNames = hasAlias
    ? appendChild(names, pair(name.lineno, name.colno, name, parsePrimary(parserContext)))
    : appendChild(names, name);

  const withContext = parseWithContext(parserContext);
  return { names: newNames, withContext };
};

const handleBlockEnd = (
  parserContext: ParserContext,
  names: ChildrenNode,
  fromTok: Token
): void => {
  if (names.children.length === 0) {
    fail(parserContext, 'parseFrom: Expected at least one import name',
      fromTok.lineno,
      fromTok.colno);
  }

  const nextTok = peekToken(parserContext);
  if (isSymbolToken(nextTok) && nextTok.value.charAt(0) === '-') {
    parserContext.dropLeadingWhitespace = true;
  }

  nextToken(parserContext);
};

export const parseFrom = (parserContext: ParserContext): Node => {
  const fromTok = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'from')) {
    fail(parserContext, 'parseFrom: expected from');
  }

  const template = parseExpression(parserContext);

  if (!skipSymbol(parserContext, 'import')) {
    fail(parserContext, 'parseFrom: expected import',
      fromTok.lineno,
      fromTok.colno);
  }

  let names: ChildrenNode = nodeList(fromTok.lineno, fromTok.colno);
  let withContext: boolean | null | undefined;

  for (;;) {
    const nextTok = peekToken(parserContext);
    if (nextTok.type === TOKEN_BLOCK_END) {
      handleBlockEnd(parserContext, names, fromTok);
      break;
    }

    if (names.children.length > 0 && !skip(parserContext, TOKEN_COMMA)) {
      fail(parserContext, 'parseFrom: expected comma',
        fromTok.lineno,
        fromTok.colno);
    }

    const result = parseImportName(parserContext, names);
    names = result.names;
    withContext = result.withContext;
  }

  return fromImportNode(fromTok.lineno, fromTok.colno, {
    template,
    names,
    withContext: withContext ?? false,
  });
};
