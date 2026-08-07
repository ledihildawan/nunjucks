import { peekToken, skipSymbol, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";

export const parseWithContext = (parserContext: ParserContext): boolean | null => {
  const tok = peekToken(parserContext);

  const withContext: boolean | null = skipSymbol(parserContext, 'with')
    ? true
    : skipSymbol(parserContext, 'without')
      ? false
      : null;

  if (withContext !== null && !skipSymbol(parserContext, 'context')) {
    fail(parserContext, 'parseFrom: expected context after with/without',
      tok.lineno,
      tok.colno);
  }

  return withContext;
};
