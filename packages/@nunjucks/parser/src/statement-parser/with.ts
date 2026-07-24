import { peekToken, skipSymbol, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";

export const parseWithContext = (ctx: ParserContext): boolean | null => {
  const tok = peekToken(ctx);

  let withContext: boolean | null = null;

  if (skipSymbol(ctx, 'with')) {
    withContext = true;
  } else if (skipSymbol(ctx, 'without')) {
    withContext = false;
  }

  if (withContext !== null && !skipSymbol(ctx, 'context')) {
      fail(ctx, 'parseFrom: expected context after with/without',
        tok.lineno,
        tok.colno);
    }

  return withContext;
};
