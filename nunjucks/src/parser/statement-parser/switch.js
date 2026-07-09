import { Switch, Case } from '../../nodes.js';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseSwitch = (ctx) => {
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

  const expr = ctx.parseExpression();

  advanceAfterBlockEnd(ctx, switchStart);
  ctx.parseUntilBlocks(caseStart, caseDefault, switchEnd);

  let tok = peekToken(ctx);

  const cases = [];
  let defaultCase;

  do {
    skipSymbol(ctx, caseStart);
    const cond = ctx.parseExpression();
    advanceAfterBlockEnd(ctx, switchStart);
    const body = ctx.parseUntilBlocks(caseStart, caseDefault, switchEnd);
    cases.push(new Case(tok.line, tok.col, cond, body));
    tok = peekToken(ctx);
  } while (tok && tok.value === caseStart);

  switch (tok.value) {
    case caseDefault:
      advanceAfterBlockEnd(ctx);
      defaultCase = ctx.parseUntilBlocks(switchEnd);
      advanceAfterBlockEnd(ctx);
      break;
    case switchEnd:
      advanceAfterBlockEnd(ctx);
      break;
    default:
      fail(ctx, 'parseSwitch: expected "case," "default" or "endswitch," got EOF.');
  }

  return new Switch(tag.lineno, tag.colno, expr, cases, defaultCase);
};
