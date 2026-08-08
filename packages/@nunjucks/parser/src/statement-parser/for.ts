import { TOKEN_COMMA } from '@nunjucks/lexer';
import { appendChild, array, forNode, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, skip, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary, parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { tryParsePattern } from "../node-parser/pattern.ts";
import { loc } from '@nunjucks/shared';

const parseForTarget = (parserContext: ParserContext): Node => {
  const patternNode = tryParsePattern(parserContext);
  if (patternNode) {
    return patternNode;
  }

  const name = parsePrimary(parserContext);
  if (!isSymbol(name)) {
    fail(parserContext, 'parseFor: variable name expected for loop');
  }

  const { type } = peekToken(parserContext);
  if (type !== TOKEN_COMMA) { return name; }

  const key = name;
  const arrNode = array(loc(key));
  let result = appendChild(arrNode, key);
  while (skip(parserContext, TOKEN_COMMA)) {
    const prim = parsePrimary(parserContext);
    result = appendChild(result, prim);
  }
  return result;
};

export const parseFor = (parserContext: ParserContext): Node => {
  const forTok = peekToken(parserContext);

  if (!skipSymbol(parserContext, 'for')) {
    return fail(parserContext, 'parseFor: expected for', forTok.lineno, forTok.colno);
  }
  const endBlock = 'endfor';

  const name = parseForTarget(parserContext);

  if (!skipSymbol(parserContext, 'in')) {
    fail(parserContext, 'parseFor: expected "in" keyword for loop',
      forTok.lineno,
      forTok.colno);
  }

  const arr = parseExpression(parserContext);
  advanceAfterBlockEnd(parserContext, String(forTok.value));

  const body = parseUntilBlocks(parserContext, endBlock, 'else');

  let alternate: Node | null = null;
  if (skipSymbol(parserContext, 'else')) {
    advanceAfterBlockEnd(parserContext, 'else');
    alternate = parseUntilBlocks(parserContext, endBlock);
  }

  advanceAfterBlockEnd(parserContext);

  return forNode(loc(forTok), { name, arr, body, alternate });
};
