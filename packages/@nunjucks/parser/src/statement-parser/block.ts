import { block, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parsePrimary } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { loc } from '@nunjucks/lexer';

export const parseBlock = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'block')) {
    return fail(parserContext, 'parseBlock: expected block', { lineno: tag.lineno, colno: tag.colno });
  }

  const nameR = parsePrimary(parserContext);
  if (isErr(nameR)) { return nameR; }
  const name = nameR.value;
  if (!isSymbol(name)) {
    return fail(parserContext, 'parseBlock: variable name expected', { lineno: tag.lineno, colno: tag.colno });
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, 'block');
  if (isErr(blockEndR)) { return blockEndR; }

  const bodyR = parseUntilBlocks(parserContext, 'endblock');
  if (isErr(bodyR)) { return bodyR; }
  skipSymbol(parserContext, 'endblock');
  skipSymbol(parserContext, String(name.value));

  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;

  const finalR = advanceAfterBlockEnd(parserContext, String(tok.value));
  if (isErr(finalR)) { return finalR; }

  return ok(block(loc(tag), { name: String(name.value), body: bodyR.value }));
};
