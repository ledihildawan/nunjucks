import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { include } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';

/**
 * Parses `{% include templateExpr %}` followed by at most one of `only` or
 * `with contextExpr`, then the optional `ignore missing` modifier — in that
 * fixed order.
 */
export const parseInclude = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagName = 'include';
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) {
    return tagR;
  }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, tagName)) {
    return fail(parserContext, { message: `parseInclude: expected ${tagName}` });
  }

  const templateR = parseExpression(parserContext);
  if (isErr(templateR)) {
    return templateR;
  }

  const includeFields: { template: Node; ignoreMissing?: boolean; only?: boolean; with?: Node } = {
    template: templateR.value,
  };

  if (skipSymbol(parserContext, 'only')) {
    includeFields.only = true;
  } else if (skipSymbol(parserContext, 'with')) {
    const withR = parseExpression(parserContext);
    if (isErr(withR)) {
      return withR;
    }
    includeFields.with = withR.value;
  }

  if (skipSymbol(parserContext, 'ignore') && skipSymbol(parserContext, 'missing')) {
    includeFields.ignoreMissing = true;
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, String(tag.value));
  if (isErr(blockEndR)) {
    return blockEndR;
  }
  return ok(include(loc(tag), includeFields));
};
