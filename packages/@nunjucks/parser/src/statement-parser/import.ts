import { importNode, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseExpression } from "../expression-parser/index.ts";
import { parseWithContext } from "./import-context.ts";
import { loc } from '@nunjucks/shared';

export const parseImport = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const importTokR = peekToken(parserContext);
  if (isErr(importTokR)) { return importTokR; }
  const importTok = importTokR.value;
  if (!skipSymbol(parserContext, 'import')) {
    return fail(parserContext, 'parseImport: expected import',
      importTok.lineno,
      importTok.colno);
  }

  const templateR = parseExpression(parserContext);
  if (isErr(templateR)) { return templateR; }

  if (!skipSymbol(parserContext, 'as')) {
    return fail(parserContext, 'parseImport: expected "as" keyword',
      importTok.lineno,
      importTok.colno);
  }

  const targetR = parseExpression(parserContext);
  if (isErr(targetR)) { return targetR; }
  const target = targetR.value;
  const withContextR = parseWithContext(parserContext);
  if (isErr(withContextR)) { return withContextR; }
  if (!isSymbol(target)) {
    return fail(parserContext, 'parseImport: expected import target', target.lineno, target.colno);
  }
  const node = importNode(loc(importTok), {
    template: templateR.value,
    target: String(target.value),
    withContext: withContextR.value ?? false,
  });

  const blockEndR = advanceAfterBlockEnd(parserContext, String(importTok.value));
  if (isErr(blockEndR)) { return blockEndR; }

  return ok(node);
};
