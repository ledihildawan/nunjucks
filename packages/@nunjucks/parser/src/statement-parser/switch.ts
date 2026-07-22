import { case_, switch_ } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../top-level.ts";

export const parseSwitch = (ctx: ParserContext): Node => {
  const switchStart = 'switch';
  const switchEnd = 'endswitch';
  const caseStart = 'case';
  const caseDefault = 'default';

  const tag = peekToken(ctx);

  if (
    !skipSymbol(ctx, switchStart)
    && !skipSymbol(ctx, caseStart)
    && !skipSymbol(ctx, caseDefault)
  ) {
    fail(ctx, 'parseSwitch: expected "switch," "case" or "default"', tag.lineno, tag.colno);
  }

  const expr = parseExpression(ctx);

  advanceAfterBlockEnd(ctx, switchStart);
  parseUntilBlocks(ctx, caseStart, caseDefault, switchEnd);

  let tok = peekToken(ctx);

  const cases: Node[] = [];
  let defaultCase: Node | undefined;

  do {
    skipSymbol(ctx, caseStart);
    const cond = parseExpression(ctx);
    advanceAfterBlockEnd(ctx, switchStart);
    const body = parseUntilBlocks(ctx, caseStart, caseDefault, switchEnd);
    cases.push(case_(tok.lineno, tok.colno, cond, body));
    tok = peekToken(ctx);
  } while (tok && tok.value === caseStart);

  switch (tok.value) {
    case caseDefault:
      advanceAfterBlockEnd(ctx);
      defaultCase = parseUntilBlocks(ctx, switchEnd);
      advanceAfterBlockEnd(ctx);
      break;
    case switchEnd:
      advanceAfterBlockEnd(ctx);
      break;
    default:
      fail(ctx, 'parseSwitch: expected "case," "default" or "endswitch," got EOF.');
  }

  return switch_(tag.lineno, tag.colno, expr, cases, defaultCase ?? null);
};
