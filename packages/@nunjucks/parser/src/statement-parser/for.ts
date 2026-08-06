import { TOKEN_COMMA } from '@nunjucks/lexer';
import { appendChild, array, for_, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, skip, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary, parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { tryParsePattern } from "../node-parser/pattern.ts";

const parseForTarget = (ctx: ParserContext): Node => {
  const patternNode = tryParsePattern(ctx);
  if (patternNode) {
    return patternNode;
  }

  const name = parsePrimary(ctx);
  if (!isSymbol(name)) {
    fail(ctx, 'parseFor: variable name expected for loop');
  }

  const { type } = peekToken(ctx);
  if (type !== TOKEN_COMMA) { return name; }

  const key = name;
  const arrNode = array(key.lineno, key.colno);
  let result = appendChild(arrNode, key);
  while (skip(ctx, TOKEN_COMMA)) {
    const prim = parsePrimary(ctx);
    result = appendChild(result, prim);
  }
  return result;
};

export const parseFor = (ctx: ParserContext): Node => {
  const forTok = peekToken(ctx);

  if (!skipSymbol(ctx, 'for')) {
    return fail(ctx, 'parseFor: expected for', forTok.lineno, forTok.colno);
  }
  const endBlock = 'endfor';

  const name = parseForTarget(ctx);

  if (!skipSymbol(ctx, 'in')) {
    fail(ctx, 'parseFor: expected "in" keyword for loop',
      forTok.lineno,
      forTok.colno);
  }

  const arr = parseExpression(ctx);
  advanceAfterBlockEnd(ctx, String(forTok.value));

  const body = parseUntilBlocks(ctx, endBlock, 'else');

  let else_: Node | null = null;
  if (skipSymbol(ctx, 'else')) {
    advanceAfterBlockEnd(ctx, 'else');
    else_ = parseUntilBlocks(ctx, endBlock);
  }

  advanceAfterBlockEnd(ctx);

  return for_(forTok.lineno, forTok.colno, { name, arr, body, else_ });
};
