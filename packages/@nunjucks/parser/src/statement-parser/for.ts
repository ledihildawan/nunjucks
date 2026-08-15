import type { TemplateError } from '@nunjucks/error-formatter';
import { TOKEN_COMMA } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { appendChild, array, forNode, isSymbol } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skip, skipSymbol } from '../cursor.ts';
import { parseExpression, parsePrimary } from '../expression-parser/index.ts';
import { tryParsePattern } from '../node-parser/pattern.ts';
import { parseUntilBlocks } from '../parse-root.ts';

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
    return fail(parserContext, 'parseFor: variable name expected for loop');
  }

  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  if (tokR.value.type !== TOKEN_COMMA) {
    return ok(name);
  }

  const key = name;
  const result = appendChild(array(loc(key)), key);
  const collectCommaList = (acc: ChildrenNode): Result<Node, TemplateError> => {
    if (!skip(parserContext, TOKEN_COMMA)) {
      return ok(acc);
    }
    const primR = parsePrimary(parserContext);
    if (isErr(primR)) {
      return primR;
    }
    return collectCommaList(appendChild(acc, primR.value));
  };
  return collectCommaList(result);
};

export const parseFor = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const forTokR = peekToken(parserContext);
  if (isErr(forTokR)) {
    return forTokR;
  }
  const forTok = forTokR.value;

  if (!skipSymbol(parserContext, 'for')) {
    return fail(parserContext, 'parseFor: expected for', {
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
    return fail(parserContext, 'parseFor: expected "in" keyword for loop', {
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

  const bodyR = parseUntilBlocks(parserContext, endBlock, 'else');
  if (isErr(bodyR)) {
    return bodyR;
  }

  let alternate: Node | null = null;
  if (skipSymbol(parserContext, 'else')) {
    const aR = advanceAfterBlockEnd(parserContext, 'else');
    if (isErr(aR)) {
      return aR;
    }
    const altBodyR = parseUntilBlocks(parserContext, endBlock);
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
