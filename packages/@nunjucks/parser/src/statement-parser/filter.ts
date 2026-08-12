import { capture, nodeList, output, pipe } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { ok, isErr, type Result } from '@nunjucks/lib';
import { loc } from '@nunjucks/lexer';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseFilterCallName, parseFilterCallArgs } from "../expression-parser/postfix/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";

export const parseFilterStatement = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const filterTokR = peekToken(parserContext);
  if (isErr(filterTokR)) { return filterTokR; }
  const filterTok = filterTokR.value;
  if (!skipSymbol(parserContext, 'filter')) {
    return fail(parserContext, 'parseFilterStatement: expected filter');
  }

  const nameR = parseFilterCallName(parserContext);
  if (isErr(nameR)) { return nameR; }
  const argsR = parseFilterCallArgs(parserContext, nameR.value);
  if (isErr(argsR)) { return argsR; }

  const blockEndR = advanceAfterBlockEnd(parserContext, String(filterTok.value));
  if (isErr(blockEndR)) { return blockEndR; }
  const capturedBodyR = parseUntilBlocks(parserContext, 'endfilter');
  if (isErr(capturedBodyR)) { return capturedBodyR; }
  const capturedBody = capture(
    loc(nameR.value),
    { body: capturedBodyR.value }
  );
  const finalR = advanceAfterBlockEnd(parserContext);
  if (isErr(finalR)) { return finalR; }

  const node = pipe(
    loc(nameR.value),
    {
      name: nameR.value,
      args: nodeList(
        loc(nameR.value),
        [capturedBody, ...argsR.value]
      ).children,
    }
  );

  return ok(output(
    loc(nameR.value),
    [node]
  ));
};
