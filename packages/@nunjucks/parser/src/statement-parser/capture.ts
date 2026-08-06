import type { Node } from '@nunjucks/nodes';
import { capture } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail, nextTokenOrNull } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { isSymbolToken } from '@nunjucks/lexer';
import { parseUntilBlocks } from "../parse-root.ts";

export const parseCapture = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'capture')) {
    fail(ctx, 'Expected capture', tag.lineno, tag.colno);
  }

  const nameTok = nextTokenOrNull(ctx);
  let varName: string | null = null;
  if (nameTok && isSymbolToken(nameTok)) {
    varName = nameTok.value;
  }

  advanceAfterBlockEnd(ctx, 'capture');
  const body = parseUntilBlocks(ctx, 'endcapture');
  skipSymbol(ctx, 'endcapture');
  advanceAfterBlockEnd(ctx, 'endcapture');

  return capture(tag.lineno, tag.colno, body, varName);
};
