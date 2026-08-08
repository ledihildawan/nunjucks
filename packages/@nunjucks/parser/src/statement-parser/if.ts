import { ifNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { loc } from '@nunjucks/shared';

export const parseIf = (parserContext: ParserContext): Node => {
  const tag = peekToken(parserContext);

  if (!(skipSymbol(parserContext, 'if') || skipSymbol(parserContext, 'elif') || skipSymbol(parserContext, 'elseif'))) {
    return fail(parserContext, 'parseIf: expected if, elif, or elseif',
      tag.lineno,
      tag.colno);
  }

  const cond = parseExpression(parserContext);
  advanceAfterBlockEnd(parserContext, String(tag.value));

  const body = parseUntilBlocks(parserContext, 'elif', 'elseif', 'else', 'endif');
  const tok = peekToken(parserContext);

  let alternate: Node | null = null;
  switch (tok?.value) {
    case 'elseif':
    case 'elif':
      alternate = parseIf(parserContext);
      break;
    case 'else':
      advanceAfterBlockEnd(parserContext);
      alternate = parseUntilBlocks(parserContext, 'endif');
      advanceAfterBlockEnd(parserContext);
      break;
    case 'endif':
      alternate = null;
      advanceAfterBlockEnd(parserContext);
      break;
    default:
      fail(parserContext, 'parseIf: expected elif, else, or endif, got end of file');
  }

  return ifNode(loc(tag), { cond, body, alternate });
};
