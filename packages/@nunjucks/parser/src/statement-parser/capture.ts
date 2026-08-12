import type { Node } from '@nunjucks/nodes';
import { capture } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail, nextTokenOrNull } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { isSymbolToken } from '@nunjucks/lexer';
import { parseUntilBlocks } from "../parse-root.ts";
import { loc } from '@nunjucks/lexer';

export const parseCapture = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'capture')) {
    return fail(parserContext, 'Expected capture', { lineno: tag.lineno, colno: tag.colno });
  }

  const nameTok = nextTokenOrNull(parserContext);
  let varName: string | null = null;
  if (nameTok && isSymbolToken(nameTok)) {
    varName = nameTok.value;
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, 'capture');
  if (isErr(blockEndR)) { return blockEndR; }
  const bodyR = parseUntilBlocks(parserContext, 'endcapture');
  if (isErr(bodyR)) { return bodyR; }
  skipSymbol(parserContext, 'endcapture');
  const finalR = advanceAfterBlockEnd(parserContext, 'endcapture');
  if (isErr(finalR)) { return finalR; }

  return ok(capture(loc(tag), { body: bodyR.value, name: varName }));
};
