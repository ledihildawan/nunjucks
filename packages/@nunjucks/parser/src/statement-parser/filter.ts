import { capture, nodeList, output, pipe } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseFilterCallName, parseFilterCallArgs } from "../expression-parser/postfix/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";

export const parseFilterStatement = (parserContext: ParserContext): Node => {
  const filterTok = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'filter')) {
    fail(parserContext, 'parseFilterStatement: expected filter');
  }

  const name = parseFilterCallName(parserContext);
  const args = parseFilterCallArgs(parserContext, name);

  advanceAfterBlockEnd(parserContext, String(filterTok.value));
  const body = capture(
    name.lineno,
    name.colno,
    parseUntilBlocks(parserContext, 'endfilter')
  );
  advanceAfterBlockEnd(parserContext);

  const node = pipe(
    name.lineno,
    name.colno,
    name,
    nodeList(
      name.lineno,
      name.colno,
      [body, ...args]
    ).children
  );

  return output(
    name.lineno,
    name.colno,
    [node]
  );
};
