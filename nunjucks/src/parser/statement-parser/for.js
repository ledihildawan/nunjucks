import * as lexer from '../../lexer/index.js';
import * as nodes from '../../nodes.js';
import {
  For,
  AsyncEach,
  AsyncAll,
  AstSymbol,
} from '../../nodes.js';
import { peekToken, skip, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseFor = (ctx) => {
  const forTok = peekToken(ctx);
  let node;
  let endBlock;

  if (skipSymbol(ctx, 'for')) {
    node = new For(forTok.lineno, forTok.colno);
    endBlock = 'endfor';
  } else if (skipSymbol(ctx, 'asyncEach')) {
    node = new AsyncEach(forTok.lineno, forTok.colno);
    endBlock = 'endeach';
  } else if (skipSymbol(ctx, 'asyncAll')) {
    node = new AsyncAll(forTok.lineno, forTok.colno);
    endBlock = 'endall';
  } else {
    fail(ctx, 'parseFor: expected for{Async}', forTok.lineno, forTok.colno);
  }

  node.name = ctx.parsePrimary();

  if (!(node.name instanceof AstSymbol)) {
    fail(ctx, 'parseFor: variable name expected for loop');
  }

  const type = peekToken(ctx).type;
  if (type === lexer.TOKEN_COMMA) {
    const key = node.name;
    node.name = new nodes.Array(key.lineno, key.colno);
    node.name.addChild(key);

    while (skip(ctx, lexer.TOKEN_COMMA)) {
      const prim = ctx.parsePrimary();
      node.name.addChild(prim);
    }
  }

  if (!skipSymbol(ctx, 'in')) {
    fail(ctx, 'parseFor: expected "in" keyword for loop',
      forTok.lineno,
      forTok.colno);
  }

  node.arr = ctx.parseExpression();
  advanceAfterBlockEnd(ctx, forTok.value);

  node.body = ctx.parseUntilBlocks(endBlock, 'else');

  if (skipSymbol(ctx, 'else')) {
    advanceAfterBlockEnd(ctx, 'else');
    node.else_ = ctx.parseUntilBlocks(endBlock);
  }

  advanceAfterBlockEnd(ctx);

  return node;
};
