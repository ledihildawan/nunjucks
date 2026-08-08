import { block, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { loc } from '@nunjucks/shared';

export const parseBlock = (parserContext: ParserContext): Node => {
  const tag = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'block')) {
    fail(parserContext, 'parseBlock: expected block', tag.lineno, tag.colno);
  }

  const name = parsePrimary(parserContext);
  if (!isSymbol(name)) {
    fail(parserContext, 'parseBlock: variable name expected',
      tag.lineno,
      tag.colno);
  }

  advanceAfterBlockEnd(parserContext, 'block');

  const body = parseUntilBlocks(parserContext, 'endblock');
  skipSymbol(parserContext, 'endblock');
  skipSymbol(parserContext, String(name.value));

  const tok = peekToken(parserContext);
  if (!tok) {
    fail(parserContext, 'parseBlock: expected endblock, got end of file');
  }

  advanceAfterBlockEnd(parserContext, String(tok.value));

  return block(loc(tag), String(name.value), body);
};
