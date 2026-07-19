import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
  TOKEN_OPERATOR,
} from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { peekToken, skip, skipValue, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';
import { tryParsePattern } from '../node-parsers/index.js';

export const parseSet = (ctx) => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'set')) {
    fail(ctx, 'parseSet: expected set', tag.lineno, tag.colno);
  }

  const node = nodes.set(tag.lineno, tag.colno, []);

  const patternNode = tryParsePattern(ctx);
  if (patternNode) {
    node.targets.push(patternNode);
  } else {
    let target;
    while ((target = ctx.parsePrimary())) {
      node.targets.push(target);

      if (!skip(ctx, TOKEN_COMMA)) {
        break;
      }
    }
  }

    if (!skipValue(ctx, TOKEN_OPERATOR, '=')) {
    const assignOps = ['||=', '&&=', '??=', '**=', '//=', ':='];
    let foundOp = null;

    for (const op of assignOps) {
      const tok = peekToken(ctx);
      if (tok && tok.type === TOKEN_OPERATOR && tok.value === op) {
        ctx.nextToken();
        foundOp = op;
        break;
      }
    }

    if (!foundOp) {
      if (!skip(ctx, TOKEN_BLOCK_END)) {
        fail(ctx, 'parseSet: expected =, ||= , &&=, ??=, **=, //=, := or block end in set tag',
          tag.lineno,
          tag.colno);
      } else {
        node.body = nodes.capture(
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
