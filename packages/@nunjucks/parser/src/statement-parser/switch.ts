import { caseNode, switchNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { loc } from '@nunjucks/shared';

const SWITCH_TOKENS = {
  switchStart: 'switch',
  switchEnd: 'endswitch',
  caseStart: 'case',
  caseDefault: 'default',
} as const;

const parseSwitchCases = (parserContext: ParserContext, cases: Node[]): void => {
  let tok = peekToken(parserContext);
  while (tok?.value === SWITCH_TOKENS.caseStart) {
    skipSymbol(parserContext, SWITCH_TOKENS.caseStart);
    const cond = parseExpression(parserContext);
    advanceAfterBlockEnd(parserContext, SWITCH_TOKENS.switchStart);
    const body = parseUntilBlocks(parserContext, SWITCH_TOKENS.caseStart, SWITCH_TOKENS.caseDefault, SWITCH_TOKENS.switchEnd);
    cases.push(caseNode(loc(tok), { cond, body }));
    tok = peekToken(parserContext);
  }
};

const handleSwitchEnd = (parserContext: ParserContext): Node | undefined => {
  const tok = peekToken(parserContext);
  switch (tok.value) {
    case SWITCH_TOKENS.caseDefault:
      advanceAfterBlockEnd(parserContext);
      return parseUntilBlocks(parserContext, SWITCH_TOKENS.switchEnd);
    case SWITCH_TOKENS.switchEnd:
      advanceAfterBlockEnd(parserContext);
      return undefined;
    default:
      fail(parserContext, 'parseSwitch: expected "case," "default" or "endswitch," got EOF.');
  }
};

export const parseSwitch = (parserContext: ParserContext): Node => {
  const tag = peekToken(parserContext);

  if (
    !((skipSymbol(parserContext, SWITCH_TOKENS.switchStart)
    || skipSymbol(parserContext, SWITCH_TOKENS.caseStart))
    || skipSymbol(parserContext, SWITCH_TOKENS.caseDefault))
  ) {
    fail(parserContext, 'parseSwitch: expected "switch," "case" or "default"', tag.lineno, tag.colno);
  }

  const expr = parseExpression(parserContext);

  advanceAfterBlockEnd(parserContext, SWITCH_TOKENS.switchStart);
  parseUntilBlocks(parserContext, SWITCH_TOKENS.caseStart, SWITCH_TOKENS.caseDefault, SWITCH_TOKENS.switchEnd);

  const cases: Node[] = [];
  parseSwitchCases(parserContext, cases);

  const defaultCase = ((): Node | undefined => {
    if (peekToken(parserContext).value === SWITCH_TOKENS.caseDefault) {
      const result = handleSwitchEnd(parserContext);
      advanceAfterBlockEnd(parserContext);
      return result;
    } else {
      handleSwitchEnd(parserContext);
      return undefined;
    }
  })();

  return switchNode(loc(tag), { expr, cases, default_: defaultCase ?? null });
};
