import type { TemplateError } from '@nunjucks/error-formatter';
import { TOKEN_COMMA } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { array, forNode, isSymbol } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skip, skipSymbol } from '../cursor.ts';
import { parseExpression, parsePrimary } from '../expression-parser/index.ts';
import { tryParsePattern } from '../node-parser/pattern.ts';

const parseForTarget = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const patternNodeR = tryParsePattern(parserContext);
  if (isErr(patternNodeR)) {
    return patternNodeR;
  }
  const patternNode = patternNodeR.value;
  if (patternNode) {
    return ok(patternNode);
  }

  const nameR = parsePrimary(parserContext);
  if (isErr(nameR)) {
    return nameR;
  }
  const name = nameR.value;
  if (!isSymbol(name)) {
    return fail(parserContext, { message: 'parseFor: variable name expected for loop' });
  }

  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  if (tokR.value.type !== TOKEN_COMMA) {
    return ok(name);
  }

  const key = name;
  // WHY: iterative loop with a local accumulator (parser loop exemption) — the recursive
  // collectCommaList recursed once per comma-separated target and threaded each one
  // through the copying appendChild (O(n²)), so `{% for a,b,c,... %}` lists
  // overflowed the stack and crawled on long lists.
  const targets: Node[] = [key];
  while (skip(parserContext, TOKEN_COMMA)) {
    const primR = parsePrimary(parserContext);
    if (isErr(primR)) {
      return primR;
    }
    targets.push(primR.value);
  }
  return ok(array(loc(key), targets));
};

/**
 * Parses `{% for %}`: a destructuring pattern, symbol, or comma list as
 * the loop target, an iterable expression, and an optional `else` body
 * used when the iterable is empty.
 */
export const parseFor = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const forTokR = peekToken(parserContext);
  if (isErr(forTokR)) {
    return forTokR;
  }
  const forTok = forTokR.value;

  if (!skipSymbol(parserContext, 'for')) {
    return fail(parserContext, {
      message: 'parseFor: expected for',
      lineno: forTok.lineno,
      colno: forTok.colno,
    });
  }
  const endBlock = 'endfor';

  const nameR = parseForTarget(parserContext);
  if (isErr(nameR)) {
    return nameR;
  }
  const name = nameR.value;

  if (!skipSymbol(parserContext, 'in')) {
    return fail(parserContext, {
      message: 'parseFor: expected "in" keyword for loop',
      lineno: forTok.lineno,
      colno: forTok.colno,
    });
  }

  const arrR = parseExpression(parserContext);
  if (isErr(arrR)) {
    return arrR;
  }
  const blockEndR = advanceAfterBlockEnd(parserContext, String(forTok.value));
  if (isErr(blockEndR)) {
    return blockEndR;
  }

  const bodyR = parserContext.parseUntilBlocks(endBlock, 'else');
  if (isErr(bodyR)) {
    return bodyR;
  }

  let alternate: Node | null = null;
  if (skipSymbol(parserContext, 'else')) {
    const advanceResult = advanceAfterBlockEnd(parserContext, 'else');
    if (isErr(advanceResult)) {
      return advanceResult;
    }
    const altBodyR = parserContext.parseUntilBlocks(endBlock);
    if (isErr(altBodyR)) {
      return altBodyR;
    }
    alternate = altBodyR.value;
  }

  const finalR = advanceAfterBlockEnd(parserContext);
  if (isErr(finalR)) {
    return finalR;
  }

  return ok(forNode(loc(forTok), { name, arr: arrR.value, body: bodyR.value, alternate }));
};
