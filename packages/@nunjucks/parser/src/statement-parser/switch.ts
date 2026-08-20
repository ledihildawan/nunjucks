import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { caseNode, switchNode } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';

const SWITCH_TOKENS = {
  switchStart: 'switch',
  switchEnd: 'endswitch',
  caseStart: 'case',
  caseDefault: 'default',
} as const;

const parseSwitchCases = (
  parserContext: ParserContext,
  cases: Node[]
): Result<void, TemplateError> => {
  // WHY: iterative loop (parser loop exemption) — the recursive parseLoop recursed once
  // per `case` branch, so long switch-case chains overflowed the stack.
  let tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }

  while (tokR.value.value === SWITCH_TOKENS.caseStart) {
    const tok = tokR.value;
    skipSymbol(parserContext, SWITCH_TOKENS.caseStart);
    const condR = parseExpression(parserContext);
    if (isErr(condR)) {
      return condR;
    }
    const blockEndR = advanceAfterBlockEnd(parserContext, SWITCH_TOKENS.switchStart);
    if (isErr(blockEndR)) {
      return blockEndR;
    }
    const bodyR = parserContext.parseUntilBlocks(
      SWITCH_TOKENS.caseStart,
      SWITCH_TOKENS.caseDefault,
      SWITCH_TOKENS.switchEnd
    );
    if (isErr(bodyR)) {
      return bodyR;
    }
    cases.push(caseNode(loc(tok), { cond: condR.value, body: bodyR.value }));
    tokR = peekToken(parserContext);
    if (isErr(tokR)) {
      return tokR;
    }
  }
  return ok(undefined);
};

const handleSwitchEnd = (parserContext: ParserContext): Result<Node | undefined, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  switch (tok.value) {
    case SWITCH_TOKENS.caseDefault: {
      const advanceResult = advanceAfterBlockEnd(parserContext);
      if (isErr(advanceResult)) {
        return advanceResult;
      }
      const bodyR = parserContext.parseUntilBlocks(SWITCH_TOKENS.switchEnd);
      if (isErr(bodyR)) {
        return bodyR;
      }
      // WHY: the terminating `{% endswitch %}` is consumed here, making this switch the
      // single owner of endswitch consumption for both default and no-default endings.
      const endResult = advanceAfterBlockEnd(parserContext);
      if (isErr(endResult)) {
        return endResult;
      }
      return bodyR;
    }
    case SWITCH_TOKENS.switchEnd: {
      const advanceResult = advanceAfterBlockEnd(parserContext);
      if (isErr(advanceResult)) {
        return advanceResult;
      }
      return ok(undefined);
    }
    default:
      return fail(parserContext, {
        message: 'parseSwitch: expected "case," "default" or "endswitch," got EOF.',
      });
  }
};

/**
 * Parses `{% switch expr %}` with `case` branches and an optional
 * `default` arm, consuming the terminating `{% endswitch %}`.
 */
export const parseSwitch = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) {
    return tagR;
  }
  const tag = tagR.value;

  if (
    !(
      skipSymbol(parserContext, SWITCH_TOKENS.switchStart) ||
      skipSymbol(parserContext, SWITCH_TOKENS.caseStart) ||
      skipSymbol(parserContext, SWITCH_TOKENS.caseDefault)
    )
  ) {
    return fail(parserContext, {
      message: 'parseSwitch: expected "switch," "case" or "default"',
      lineno: tag.lineno,
      colno: tag.colno,
    });
  }

  const exprR = parseExpression(parserContext);
  if (isErr(exprR)) {
    return exprR;
  }

  const headerEndR = advanceAfterBlockEnd(parserContext, SWITCH_TOKENS.switchStart);
  if (isErr(headerEndR)) {
    return headerEndR;
  }
  const headerBodyR = parserContext.parseUntilBlocks(
    SWITCH_TOKENS.caseStart,
    SWITCH_TOKENS.caseDefault,
    SWITCH_TOKENS.switchEnd
  );
  if (isErr(headerBodyR)) {
    return headerBodyR;
  }

  const cases: Node[] = [];
  const casesR = parseSwitchCases(parserContext, cases);
  if (isErr(casesR)) {
    return casesR;
  }

  const defaultCaseR = handleSwitchEnd(parserContext);
  if (isErr(defaultCaseR)) {
    return defaultCaseR;
  }

  return ok(
    switchNode(loc(tag), { expr: exprR.value, cases, default_: defaultCaseR.value ?? null })
  );
};
