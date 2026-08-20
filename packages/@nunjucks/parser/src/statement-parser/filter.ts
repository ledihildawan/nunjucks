import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { capture, nodeList, output, pipe } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parseFilterCallArgs, parseFilterCallName } from '../expression-parser/postfix/index.ts';

/**
 * Parses `{% filter name(args) %}...{% endfilter %}` by capturing the body
 * and piping it through the filter as an output node.
 */
export const parseFilterStatement = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const filterTokR = peekToken(parserContext);
  if (isErr(filterTokR)) {
    return filterTokR;
  }
  const filterTok = filterTokR.value;
  if (!skipSymbol(parserContext, 'filter')) {
    return fail(parserContext, { message: 'parseFilterStatement: expected filter' });
  }

  const nameR = parseFilterCallName(parserContext);
  if (isErr(nameR)) {
    return nameR;
  }
  const argsR = parseFilterCallArgs(parserContext, nameR.value);
  if (isErr(argsR)) {
    return argsR;
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, String(filterTok.value));
  if (isErr(blockEndR)) {
    return blockEndR;
  }
  const capturedBodyR = parserContext.parseUntilBlocks('endfilter');
  if (isErr(capturedBodyR)) {
    return capturedBodyR;
  }
  const capturedBody = capture(loc(nameR.value), { body: capturedBodyR.value });
  const finalR = advanceAfterBlockEnd(parserContext);
  if (isErr(finalR)) {
    return finalR;
  }

  const node = pipe(loc(nameR.value), {
    name: nameR.value,
    args: nodeList(loc(nameR.value), [capturedBody, ...argsR.value]).children,
  });

  return ok(output(loc(nameR.value), [node]));
};
