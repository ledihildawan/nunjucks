import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
} from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { nextToken, peekToken, skip, skipSymbol, fail } from '../cursor.js';
import { parseWithContext } from './with.js';

export const parseFrom = (ctx) => {
  const fromTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'from')) {
    fail(ctx, 'parseFrom: expected from');
  }

  const template = ctx.parseExpression();

  if (!skipSymbol(ctx, 'import')) {
    fail(ctx, 'parseFrom: expected import',
      fromTok.lineno,
      fromTok.colno);
  }

  const names = nodes.nodeList();
  let withContext;

  while (true) {
    const nextTok = peekToken(ctx);
    if (nextTok.type === TOKEN_BLOCK_END) {
      if (!names.children.length) {
        fail(ctx, 'parseFrom: Expected at least one import name',
          fromTok.lineno,
          fromTok.colno);
      }

      if (nextTok.value.charAt(0) === '-') {
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

    const name = ctx.parsePrimary();
    if (name.value.charAt(0) === '_') {
      fail(ctx, 'parseFrom: names starting with an underscore cannot be imported',
        name.lineno,
        name.colno);
    }

    if (skipSymbol(ctx, 'as')) {
      const alias = ctx.parsePrimary();
      names.addChild(nodes.pair(name.lineno,
        name.colno,
        name,
        alias));
    } else {
      names.addChild(name);
    }

    withContext = parseWithContext(ctx);
  }

  return nodes.fromImport(fromTok.lineno,
    fromTok.colno,
    template,
    names,
    withContext);
};
