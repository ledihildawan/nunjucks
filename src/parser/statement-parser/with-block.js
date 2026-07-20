import { nodes } from '../../nodes/index.js';
import { peekToken, skipSymbol, skip, skipValue, nextToken, advanceAfterBlockEnd, fail } from '../cursor.js';
import { TOKEN_BLOCK_END, TOKEN_COMMA, TOKEN_OPERATOR } from '../../lexer/token-types.js';

const isBlockEnd = (tok) => tok && tok.type === TOKEN_BLOCK_END;

export const parseWith = (ctx) => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'with')) {
    fail(ctx, 'parseWith: expected with', tag.lineno, tag.colno);
  }

  const assignments = [];
  const firstTok = peekToken(ctx);

  // Simple form: {% with %}...{% endwith %}
  if (isBlockEnd(firstTok)) {
    advanceAfterBlockEnd(ctx, 'with');
  }
  // Symbol found - parse it, then check if followed by '='
  else if (firstTok && firstTok.type === 'symbol') {
    const nameSymbol = ctx.parsePrimary();
    const eqTok = peekToken(ctx);

    if (eqTok && eqTok.type === TOKEN_OPERATOR && eqTok.value === '=') {
      // Inline assignment form: name = expr, name = expr, ...
      nextToken(ctx); // consume '='

      const value = ctx.parseExpression();
      if (!value) {
        fail(ctx, 'parseWith: expected expression after =', tag.lineno, tag.colno);
      }

      assignments.push(nodes.pair(
        nameSymbol.lineno,
        nameSymbol.colno,
        nameSymbol.value,
        value
      ));

      // Parse additional comma-separated assignments
      while (skip(ctx, TOKEN_COMMA)) {
        const nextNameTok = peekToken(ctx);
        if (!nextNameTok || nextNameTok.type !== 'symbol') {
          fail(ctx, 'parseWith: expected variable name after comma', tag.lineno, tag.colno);
        }

        const nextName = ctx.parsePrimary();
        const nextEq = peekToken(ctx);
        if (!nextEq || nextEq.type !== TOKEN_OPERATOR || nextEq.value !== '=') {
          fail(ctx, 'parseWith: expected = after variable name', tag.lineno, tag.colno);
        }

        nextToken(ctx); // consume '='

        const nextValue = ctx.parseExpression();
        if (!nextValue) {
          fail(ctx, 'parseWith: expected expression after =', tag.lineno, tag.colno);
        }

        assignments.push(nodes.pair(
          nextName.lineno,
          nextName.colno,
          nextName.value,
          nextValue
        ));
      }

      advanceAfterBlockEnd(ctx, 'with');
    } else {
      // Symbol not followed by '=' → not valid with syntax
      fail(ctx, 'parseWith: expected = after variable name', tag.lineno, tag.colno);
    }
  }
  // Non-symbol first token → not valid with syntax
  else {
    fail(ctx, 'parseWith: expected variable name or block end', tag.lineno, tag.colno);
  }

  const body = ctx.parseUntilBlocks('endwith');

  if (!skipSymbol(ctx, 'endwith')) {
    fail(ctx, 'parseWith: expected endwith', tag.lineno, tag.colno);
  }

  advanceAfterBlockEnd(ctx, 'endwith');

  return nodes.with(tag.lineno, tag.colno, assignments, body);
};
