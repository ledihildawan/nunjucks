import { TOKEN_COMMA } from '../../lexer/token-types.js';
import {
  nodes,
} from '../../nodes/index.js';
import { peekToken, skip, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';
import { tryParsePattern } from '../node-parsers/index.js';

export const parseFor = (ctx) => {
  const forTok = peekToken(ctx);
  let node;
  let endBlock;

  if (skipSymbol(ctx, 'for')) {
    node = nodes.for(forTok.lineno, forTok.colno);
    endBlock = 'endfor';
  } else {
    fail(ctx, 'parseFor: expected for', forTok.lineno, forTok.colno);
  }

  const patternNode = tryParsePattern(ctx);
  if (patternNode) {
    node.name = patternNode;
  } else {
    node.name = ctx.parsePrimary();

    if (!nodes.isSymbol(node.name)) {
      fail(ctx, 'parseFor: variable name expected for loop');
    }

    const type = peekToken(ctx).type;
    if (type === TOKEN_COMMA) {
      const key = node.name;
      node.name = nodes.array(key.lineno, key.colno);
      node.name.addChild(key);

      while (skip(ctx, TOKEN_COMMA)) {
        const prim = ctx.parsePrimary();
        node.name.addChild(prim);
      }
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
