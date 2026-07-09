import { peekToken, skipSymbol, fail } from '../cursor.js';

export const parseWithContext = (ctx) => {
  const tok = peekToken(ctx);

  let withContext = null;

  if (skipSymbol(ctx, 'with')) {
    withContext = true;
  } else if (skipSymbol(ctx, 'without')) {
    withContext = false;
  }

  if (withContext !== null) {
    if (!skipSymbol(ctx, 'context')) {
      fail(ctx, 'parseFrom: expected context after with/without',
        tok.lineno,
        tok.colno);
    }
  }

  return withContext;
};
