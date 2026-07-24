import { TOKEN_COMMA } from '@nunjucks/lexer';
import { appendChild, array, for_, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, skip, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary, parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../top-level.ts";
import { tryParsePattern } from "../node-parsers/index.ts";

export const parseFor = (ctx: ParserContext): Node => {
  const forTok = peekToken(ctx);
  let node: Node;
  let endBlock: string;

  if (skipSymbol(ctx, 'for')) {
    node = for_(forTok.lineno, forTok.colno);
    endBlock = 'endfor';
  } else {
    return fail(ctx, 'parseFor: expected for', forTok.lineno, forTok.colno);
  }

  const patternNode = tryParsePattern(ctx);
  if (patternNode) {
    node.name = patternNode;
  } else {
    node.name = parsePrimary(ctx);

    if (!isSymbol(node.name)) {
      fail(ctx, 'parseFor: variable name expected for loop');
    }

    const type = peekToken(ctx).type;
    if (type === TOKEN_COMMA) {
      const key = node.name as Node;
      node.name = array(key.lineno, key.colno);
      node.name = appendChild(node.name as ReturnType<typeof array>, key);

      while (skip(ctx, TOKEN_COMMA)) {
        const prim = parsePrimary(ctx);
        node.name = appendChild(node.name as ReturnType<typeof array>, prim);
      }
    }
  }

  if (!skipSymbol(ctx, 'in')) {
    fail(ctx, 'parseFor: expected "in" keyword for loop',
      forTok.lineno,
      forTok.colno);
  }

  node.arr = parseExpression(ctx);
  advanceAfterBlockEnd(ctx, forTok.value as string);

  node.body = parseUntilBlocks(ctx, endBlock, 'else');

  if (skipSymbol(ctx, 'else')) {
    advanceAfterBlockEnd(ctx, 'else');
    node.else_ = parseUntilBlocks(ctx, endBlock);
  }

  advanceAfterBlockEnd(ctx);

  return node;
};
