import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
} from '@nunjucks/lexer';
import { fromImport, nodeList, pair, pushChild } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, peekToken, skip, skipSymbol, fail } from "../cursor.ts";
import type { ParserContext, MutableNode } from "../cursor.ts";
import { parseExpression, parsePrimary } from "../expression-parser/index.ts";
import { parseWithContext } from "./with.ts";

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

  const names = (nodeList as () => Node)() as MutableNode;
  let withContext;

  while (true) {
    const nextTok = peekToken(ctx);
    if (nextTok.type === TOKEN_BLOCK_END) {
      if (names.children.length === 0) {
        fail(ctx, 'parseFrom: Expected at least one import name',
          fromTok.lineno,
          fromTok.colno);
      }

      if ((nextTok.value as string).charAt(0) === '-') {
        ctx.dropLeadingWhitespace = true;
      }

      nextToken(ctx);
      break;
    }

    if (names.children.length > 0 && !skip(ctx, TOKEN_COMMA)) {
      fail(ctx, 'parseFrom: expected comma',
        fromTok.lineno,
        fromTok.colno);
    }

    const name = parsePrimary(ctx);
    if ((name.value as string).charAt(0) === '_') {
      fail(ctx, 'parseFrom: names starting with an underscore cannot be imported',
        name.lineno,
        name.colno);
    }

    if (skipSymbol(ctx, 'as')) {
      const alias = parsePrimary(ctx);
      pushChild(names, pair(name.lineno,
        name.colno,
        name,
        alias));
    } else {
      pushChild(names, name);
    }

    withContext = parseWithContext(ctx);
  }

  return fromImport(fromTok.lineno,
    fromTok.colno,
    template,
    names,
    withContext as boolean);
};
