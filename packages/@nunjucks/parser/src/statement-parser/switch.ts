import { case_, switch_ } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/inline.ts";
import { parseUntilBlocks } from "../top-level.ts";

const SWITCH_TOKENS = {
  switchStart: 'switch',
  switchEnd: 'endswitch',
  caseStart: 'case',
  caseDefault: 'default',
} as const;

const parseSwitchCases = (ctx: ParserContext, cases: Node[]): void => {
  let tok = peekToken(ctx);
  while (tok && tok.value === SWITCH_TOKENS.caseStart) {
    skipSymbol(ctx, SWITCH_TOKENS.caseStart);
    const cond = parseExpression(ctx);
    advanceAfterBlockEnd(ctx, SWITCH_TOKENS.switchStart);
    const body = parseUntilBlocks(ctx, SWITCH_TOKENS.caseStart, SWITCH_TOKENS.caseDefault, SWITCH_TOKENS.switchEnd);
    cases.push(case_(tok.lineno, tok.colno, cond, body));
    tok = peekToken(ctx);
  }
};

const handleSwitchEnd = (ctx: ParserContext): Node | undefined => {
  const tok = peekToken(ctx);
  switch (tok.value) {
    case SWITCH_TOKENS.caseDefault:
      advanceAfterBlockEnd(ctx);
      return parseUntilBlocks(ctx, SWITCH_TOKENS.switchEnd);
    case SWITCH_TOKENS.switchEnd:
      advanceAfterBlockEnd(ctx);
      return undefined;
    default:
      fail(ctx, 'parseSwitch: expected "case," "default" or "endswitch," got EOF.');
  }
};

export const parseSwitch = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);

  if (
    !((skipSymbol(ctx, SWITCH_TOKENS.switchStart)
    || skipSymbol(ctx, SWITCH_TOKENS.caseStart))
    || skipSymbol(ctx, SWITCH_TOKENS.caseDefault))
  ) {
    fail(ctx, 'parseSwitch: expected "switch," "case" or "default"', tag.lineno, tag.colno);
  }

  const expr = parseExpression(ctx);

  advanceAfterBlockEnd(ctx, SWITCH_TOKENS.switchStart);
  parseUntilBlocks(ctx, SWITCH_TOKENS.caseStart, SWITCH_TOKENS.caseDefault, SWITCH_TOKENS.switchEnd);

  const cases: Node[] = [];
  parseSwitchCases(ctx, cases);

  let defaultCase: Node | undefined;
  if (peekToken(ctx).value === SWITCH_TOKENS.caseDefault) {
    defaultCase = handleSwitchEnd(ctx);
    advanceAfterBlockEnd(ctx);
  } else {
    handleSwitchEnd(ctx);
  }

  return switch_(tag.lineno, tag.colno, { expr, cases, default_: defaultCase ?? null });
};
