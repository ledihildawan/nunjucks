import { ifNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { loc } from '@nunjucks/lexer';

const parseIfElseAlternate = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const elseEndR = advanceAfterBlockEnd(parserContext);
  if (isErr(elseEndR)) { return elseEndR; }
  const altBodyR = parseUntilBlocks(parserContext, 'endif');
  if (isErr(altBodyR)) { return altBodyR; }
  const endifEndR = advanceAfterBlockEnd(parserContext);
  if (isErr(endifEndR)) { return endifEndR; }
  return ok(altBodyR.value);
};

const parseIfAlternate = (parserContext: ParserContext, tok: Token): Result<Node | null, TemplateError> => {
  switch (tok?.value) {
    case 'elseif':
    case 'elif':
      return parseIf(parserContext);
    case 'else':
      return parseIfElseAlternate(parserContext);
    case 'endif': {
      const endifEndR = advanceAfterBlockEnd(parserContext);
      if (isErr(endifEndR)) { return endifEndR; }
      return ok(null);
    }
    default:
      return fail(parserContext, 'parseIf: expected elif, else, or endif, got end of file');
  }
};

export const parseIf = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;

  if (!(skipSymbol(parserContext, 'if') || skipSymbol(parserContext, 'elif') || skipSymbol(parserContext, 'elseif'))) {
    return fail(parserContext, 'parseIf: expected if, elif, or elseif', { lineno: tag.lineno, colno: tag.colno });
  }

  const condR = parseExpression(parserContext);
  if (isErr(condR)) { return condR; }
  const blockEndR = advanceAfterBlockEnd(parserContext, String(tag.value));
  if (isErr(blockEndR)) { return blockEndR; }

  const bodyR = parseUntilBlocks(parserContext, 'elif', 'elseif', 'else', 'endif');
  if (isErr(bodyR)) { return bodyR; }
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }

  const alternateR = parseIfAlternate(parserContext, tokR.value);
  if (isErr(alternateR)) { return alternateR; }

  return ok(ifNode(loc(tag), { cond: condR.value, body: bodyR.value, alternate: alternateR.value }));
};
