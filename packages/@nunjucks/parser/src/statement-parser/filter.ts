import { capture, nodeList, output, pipe } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseFilterCallName, parseFilterCallArgs } from "../postfix-parser/index.ts";
import { parseUntilBlocks } from "../top-level.ts";

export const parseFilterStatement = (ctx: ParserContext): Node => {
  const filterTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'filter')) {
    fail(ctx, 'parseFilterStatement: expected filter');
  }

  const name = parseFilterCallName(ctx);
  const args = parseFilterCallArgs(ctx, name);

  advanceAfterBlockEnd(ctx, filterTok.value as string);
  const body = capture(
    name.lineno,
    name.colno,
    parseUntilBlocks(ctx, 'endfilter')
  );
  advanceAfterBlockEnd(ctx);

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
