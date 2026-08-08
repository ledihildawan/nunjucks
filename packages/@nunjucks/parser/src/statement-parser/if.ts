import { ifNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { loc } from '@nunjucks/shared';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Result unwrap-and-return short-circuits inflate branching
export const parseIf = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;

  if (!(skipSymbol(parserContext, 'if') || skipSymbol(parserContext, 'elif') || skipSymbol(parserContext, 'elseif'))) {
    return fail(parserContext, 'parseIf: expected if, elif, or elseif',
      tag.lineno,
      tag.colno);
  }

  const condR = parseExpression(parserContext);
  if (isErr(condR)) { return condR; }
  const blockEndR = advanceAfterBlockEnd(parserContext, String(tag.value));
  if (isErr(blockEndR)) { return blockEndR; }

  const bodyR = parseUntilBlocks(parserContext, 'elif', 'elseif', 'else', 'endif');
  if (isErr(bodyR)) { return bodyR; }
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;

  let alternate: Node | null = null;
  switch (tok?.value) {
    case 'elseif':
    case 'elif': {
      const altR = parseIf(parserContext);
      if (isErr(altR)) { return altR; }
      alternate = altR.value;
      break;
    }
    case 'else': {
      const aR = advanceAfterBlockEnd(parserContext);
      if (isErr(aR)) { return aR; }
      const altBodyR = parseUntilBlocks(parserContext, 'endif');
      if (isErr(altBodyR)) { return altBodyR; }
      alternate = altBodyR.value;
      const aR2 = advanceAfterBlockEnd(parserContext);
      if (isErr(aR2)) { return aR2; }
      break;
    }
    case 'endif':
      alternate = null;
      {
        const aR = advanceAfterBlockEnd(parserContext);
        if (isErr(aR)) { return aR; }
      }
      break;
    default:
      return fail(parserContext, 'parseIf: expected elif, else, or endif, got end of file');
  }

  return ok(ifNode(loc(tag), { cond: condR.value, body: bodyR.value, alternate }));
};
