import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { importNode, isSymbol } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';
import { parseWithContext } from './import-context.ts';

export const parseImport = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const importTokR = peekToken(parserContext);
  if (isErr(importTokR)) {
    return importTokR;
  }
  const importTok = importTokR.value;
  if (!skipSymbol(parserContext, 'import')) {
    return fail(parserContext, 'parseImport: expected import', {
      lineno: importTok.lineno,
      colno: importTok.colno,
    });
  }

  const templateR = parseExpression(parserContext);
  if (isErr(templateR)) {
    return templateR;
  }

  if (!skipSymbol(parserContext, 'as')) {
    return fail(parserContext, 'parseImport: expected "as" keyword', {
      lineno: importTok.lineno,
      colno: importTok.colno,
    });
  }

  const targetR = parseExpression(parserContext);
  if (isErr(targetR)) {
    return targetR;
  }
  const target = targetR.value;
  const withContextR = parseWithContext(parserContext);
  if (isErr(withContextR)) {
    return withContextR;
  }
  if (!isSymbol(target)) {
    return fail(parserContext, 'parseImport: expected import target', {
      lineno: target.lineno,
      colno: target.colno,
    });
  }
  const node = importNode(loc(importTok), {
    template: templateR.value,
    target: String(target.value),
    withContext: withContextR.value ?? false,
  });

  const blockEndR = advanceAfterBlockEnd(parserContext, String(importTok.value));
  if (isErr(blockEndR)) {
    return blockEndR;
  }

  return ok(node);
};
