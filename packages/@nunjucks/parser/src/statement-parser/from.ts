import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
} from '@nunjucks/lexer';
import { appendChild, fromImport, nodeList, pair } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { nextToken, peekToken, skip, skipSymbol, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/inline.ts";
import { parsePrimary } from "../expression-parser/primary.ts";
import { parseWithContext } from "./with.ts";

const isUnderscore = (name: Node): boolean =>
  (name.value as string).charAt(0) === '_';

const parseImportName = (
  ctx: ParserContext,
  names: ChildrenNode
): { names: ChildrenNode; withContext: boolean | null | undefined } => {
  const name = parsePrimary(ctx);
  if (isUnderscore(name)) {
    fail(ctx, 'parseFrom: names starting with an underscore cannot be imported',
      name.lineno,
      name.colno);
  }

  const hasAlias = skipSymbol(ctx, 'as');
  const newNames = hasAlias
    ? appendChild(names, pair(name.lineno, name.colno, name, parsePrimary(ctx)))
    : appendChild(names, name);

  const withContext = parseWithContext(ctx);
  return { names: newNames, withContext };
};

const handleBlockEnd = (
  ctx: ParserContext,
  names: ChildrenNode,
  fromTok: ReturnType<typeof peekToken>
): void => {
  if (names.children.length === 0) {
    fail(ctx, 'parseFrom: Expected at least one import name',
      fromTok.lineno,
      fromTok.colno);
  }

  const nextTok = peekToken(ctx);
  if ((nextTok.value as string).charAt(0) === '-') {
    ctx.dropLeadingWhitespace = true;
  }

  nextToken(ctx);
};

export const parseFrom = (ctx: ParserContext): Node => {
  const fromTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'from')) {
    fail(ctx, 'parseFrom: expected from');
  }

  const template = parseExpression(ctx);

  if (!skipSymbol(ctx, 'import')) {
    fail(ctx, 'parseFrom: expected import',
      fromTok.lineno,
      fromTok.colno);
  }

  let names: ChildrenNode = nodeList(fromTok.lineno, fromTok.colno);
  let withContext: boolean | null | undefined;

  for (;;) {
    const nextTok = peekToken(ctx);
    if (nextTok.type === TOKEN_BLOCK_END) {
      handleBlockEnd(ctx, names, fromTok);
      break;
    }

    if (names.children.length > 0 && !skip(ctx, TOKEN_COMMA)) {
      fail(ctx, 'parseFrom: expected comma',
        fromTok.lineno,
        fromTok.colno);
    }

    const result = parseImportName(ctx, names);
    names = result.names;
    withContext = result.withContext;
  }

  return fromImport(fromTok.lineno, fromTok.colno, {
    template,
    names,
    withContext: withContext as boolean,
  });
};
