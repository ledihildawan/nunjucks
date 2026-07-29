import { TOKEN_COMMA } from '@nunjucks/lexer';
import { appendChild, array, for_, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, skip, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary } from "../expression-parser/primary.ts";
import { parseExpression } from "../expression-parser/inline.ts";
import { parseUntilBlocks } from "../top-level.ts";
import { tryParsePattern } from "../node-parsers/pattern.ts";

const parseForName = (ctx: ParserContext, node: Node): void => {
  const patternNode = tryParsePattern(ctx);
  if (patternNode) {
    node.name = patternNode;
    return;
  }

  node.name = parsePrimary(ctx);

  if (!isSymbol(node.name)) {
    fail(ctx, 'parseFor: variable name expected for loop');
    return;
  }

  const { type } = peekToken(ctx);
  if (type !== TOKEN_COMMA) { return; }

  const key = node.name as Node;
  node.name = array(key.lineno, key.colno);
  node.name = appendChild(node.name as ReturnType<typeof array>, key);

  while (skip(ctx, TOKEN_COMMA)) {
    const prim = parsePrimary(ctx);
    node.name = appendChild(node.name as ReturnType<typeof array>, prim);
  }
};

export const parseFor = (ctx: ParserContext): Node => {
  const forTok = peekToken(ctx);

  if (!skipSymbol(ctx, 'for')) {
    return fail(ctx, 'parseFor: expected for', forTok.lineno, forTok.colno);
  }
  const node = for_(forTok.lineno, forTok.colno);
  const endBlock = 'endfor';

  parseForName(ctx, node);

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
