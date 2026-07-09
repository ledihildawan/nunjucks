import * as lexer from '../../lexer/index.js';
import { Set as AstSet, Capture } from '../../nodes.js';
import { peekToken, skip, skipValue, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseSet = (ctx) => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'set')) {
    fail(ctx, 'parseSet: expected set', tag.lineno, tag.colno);
  }

  const node = new AstSet(tag.lineno, tag.colno, []);

  let target;
  while ((target = ctx.parsePrimary())) {
    node.targets.push(target);

    if (!skip(ctx, lexer.TOKEN_COMMA)) {
      break;
    }
  }

  if (!skipValue(ctx, lexer.TOKEN_OPERATOR, '=')) {
    const assignOps = ['||=', '&&=', '??='];
    let foundOp = null;

    for (const op of assignOps) {
      const tok = peekToken(ctx);
      if (tok && tok.type === lexer.TOKEN_OPERATOR && tok.value === op) {
        ctx.nextToken();
        foundOp = op;
        break;
      }
    }

    if (!foundOp) {
      if (!skip(ctx, lexer.TOKEN_BLOCK_END)) {
        fail(ctx, 'parseSet: expected =, ||= , &&=, ??= or block end in set tag',
          tag.lineno,
          tag.colno);
      } else {
        node.body = new Capture(
          tag.lineno,
          tag.colno,
          ctx.parseUntilBlocks('endset')
        );
        node.value = null;
        node.operator = null;
        advanceAfterBlockEnd(ctx);
      }
    } else {
      node.operator = foundOp;
      node.value = ctx.parseExpression();
      advanceAfterBlockEnd(ctx, tag.value);
    }
  } else {
    node.value = ctx.parseExpression();
    node.operator = null;
    advanceAfterBlockEnd(ctx, tag.value);
  }

  return node;
};
