import type { Node } from '@nunjucks/nodes';
import { capture } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail, nextTokenOrNull } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { isSymbolToken } from '@nunjucks/lexer';
import { parseUntilBlocks } from "../parse-root.ts";

export const parseCapture = (parserContext: ParserContext): Node => {
  const tag = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'capture')) {
    fail(parserContext, 'Expected capture', tag.lineno, tag.colno);
  }

  const nameTok = nextTokenOrNull(parserContext);
  let varName: string | null = null;
  if (nameTok && isSymbolToken(nameTok)) {
    varName = nameTok.value;
  }

  advanceAfterBlockEnd(parserContext, 'capture');
  const body = parseUntilBlocks(parserContext, 'endcapture');
  skipSymbol(parserContext, 'endcapture');
  advanceAfterBlockEnd(parserContext, 'endcapture');

  return capture(tag.lineno, tag.colno, body, varName);
};
