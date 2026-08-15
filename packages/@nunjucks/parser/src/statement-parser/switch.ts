import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { caseNode, switchNode } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';
import { parseUntilBlocks } from '../parse-root.ts';

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
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }

  const parseLoop = (tok: Token): Result<void, TemplateError> => {
    if (tok?.value !== SWITCH_TOKENS.caseStart) {
      return ok(undefined);
    }
    skipSymbol(parserContext, SWITCH_TOKENS.caseStart);
    const condR = parseExpression(parserContext);
    if (isErr(condR)) {
      return condR;
    }
    const blockEndR = advanceAfterBlockEnd(parserContext, SWITCH_TOKENS.switchStart);
    if (isErr(blockEndR)) {
      return blockEndR;
    }
    const bodyR = parseUntilBlocks(
      parserContext,
      SWITCH_TOKENS.caseStart,
      SWITCH_TOKENS.caseDefault,
      SWITCH_TOKENS.switchEnd
    );
    if (isErr(bodyR)) {
      return bodyR;
    }
    cases.push(caseNode(loc(tok), { cond: condR.value, body: bodyR.value }));
    const nextTokR = peekToken(parserContext);
    if (isErr(nextTokR)) {
      return nextTokR;
    }
    return parseLoop(nextTokR.value);
  };

  return parseLoop(tokR.value);
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
      return parseUntilBlocks(parserContext, SWITCH_TOKENS.switchEnd);
    }
    case SWITCH_TOKENS.switchEnd: {
      const advanceResult = advanceAfterBlockEnd(parserContext);
      if (isErr(advanceResult)) {
        return advanceResult;
      }
      return ok(undefined);
    }
    default:
      return fail(
        parserContext,
        'parseSwitch: expected "case," "default" or "endswitch," got EOF.'
      );
  }
};

const parseSwitchDefault = (
  parserContext: ParserContext
): Result<Node | undefined, TemplateError> => {
  const peekEndR = peekToken(parserContext);
  if (isErr(peekEndR)) {
    return peekEndR;
  }
  if (peekEndR.value.value !== SWITCH_TOKENS.caseDefault) {
    const resultR = handleSwitchEnd(parserContext);
    if (isErr(resultR)) {
      return resultR;
    }
    return ok(undefined);
  }
  const resultR = handleSwitchEnd(parserContext);
  if (isErr(resultR)) {
    return resultR;
  }
  const advanceResult = advanceAfterBlockEnd(parserContext);
  if (isErr(advanceResult)) {
    return advanceResult;
  }
  return ok(resultR.value);
};

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
    return fail(parserContext, 'parseSwitch: expected "switch," "case" or "default"', {
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
  const headerBodyR = parseUntilBlocks(
    parserContext,
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

  const defaultCaseR = parseSwitchDefault(parserContext);
  if (isErr(defaultCaseR)) {
    return defaultCaseR;
  }

  return ok(
    switchNode(loc(tag), { expr: exprR.value, cases, default_: defaultCaseR.value ?? null })
  );
};
