import { include } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parseExpression } from "../expression-parser/index.ts";
import { loc } from '@nunjucks/shared';

export const parseInclude = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagName = 'include';
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, tagName)) {
    return fail(parserContext, `parseInclude: expected ${tagName}`);
  }

  const templateR = parseExpression(parserContext);
  if (isErr(templateR)) { return templateR; }

  const includeFields: { template: Node; ignoreMissing?: boolean; only?: boolean; with?: Node } = {
    template: templateR.value,
  };

  if (skipSymbol(parserContext, 'only')) {
    includeFields.only = true;
  } else if (skipSymbol(parserContext, 'with')) {
    const withR = parseExpression(parserContext);
    if (isErr(withR)) { return withR; }
    includeFields.with = withR.value;
  }

  if (skipSymbol(parserContext, 'ignore') && skipSymbol(parserContext, 'missing')) {
    includeFields.ignoreMissing = true;
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, String(tag.value));
  if (isErr(blockEndR)) { return blockEndR; }
  return ok(include(loc(tag), includeFields));
};
