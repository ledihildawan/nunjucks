import { TOKEN_COMMA } from '@nunjucks/lexer';
import { appendChild, array, forNode, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { peekToken, skipSymbol, skip, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parsePrimary, parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { tryParsePattern } from "../node-parser/pattern.ts";
import { loc } from '@nunjucks/shared';

const parseForTarget = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const patternNodeR = tryParsePattern(parserContext);
  if (isErr(patternNodeR)) { return patternNodeR; }
  const patternNode = patternNodeR.value;
  if (patternNode) {
    return ok(patternNode);
  }

  const nameR = parsePrimary(parserContext);
  if (isErr(nameR)) { return nameR; }
  const name = nameR.value;
  if (!isSymbol(name)) {
    return fail(parserContext, 'parseFor: variable name expected for loop');
  }

  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  if (tokR.value.type !== TOKEN_COMMA) { return ok(name); }

  const key = name;
  let result = appendChild(array(loc(key)), key);
  while (skip(parserContext, TOKEN_COMMA)) {
    const primR = parsePrimary(parserContext);
    if (isErr(primR)) { return primR; }
    result = appendChild(result, primR.value);
  }
  return ok(result);
};

export const parseFor = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const forTokR = peekToken(parserContext);
  if (isErr(forTokR)) { return forTokR; }
  const forTok = forTokR.value;

  if (!skipSymbol(parserContext, 'for')) {
    return fail(parserContext, 'parseFor: expected for', forTok.lineno, forTok.colno);
  }
  const endBlock = 'endfor';

  const nameR = parseForTarget(parserContext);
  if (isErr(nameR)) { return nameR; }
  const name = nameR.value;

  if (!skipSymbol(parserContext, 'in')) {
    return fail(parserContext, 'parseFor: expected "in" keyword for loop',
      forTok.lineno,
      forTok.colno);
  }

  const arrR = parseExpression(parserContext);
  if (isErr(arrR)) { return arrR; }
  const blockEndR = advanceAfterBlockEnd(parserContext, String(forTok.value));
  if (isErr(blockEndR)) { return blockEndR; }

  const bodyR = parseUntilBlocks(parserContext, endBlock, 'else');
  if (isErr(bodyR)) { return bodyR; }

  let alternate: Node | null = null;
  if (skipSymbol(parserContext, 'else')) {
    const aR = advanceAfterBlockEnd(parserContext, 'else');
    if (isErr(aR)) { return aR; }
    const altBodyR = parseUntilBlocks(parserContext, endBlock);
    if (isErr(altBodyR)) { return altBodyR; }
    alternate = altBodyR.value;
  }

  const finalR = advanceAfterBlockEnd(parserContext);
  if (isErr(finalR)) { return finalR; }

  return ok(forNode(loc(forTok), { name, arr: arrR.value, body: bodyR.value, alternate }));
};
