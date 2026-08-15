import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { TOKEN_SYMBOL } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node, WhenNode } from '@nunjucks/nodes';
import { match, when } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parseExpression, parsePrimary } from '../expression-parser/index.ts';
import { tryParsePattern } from '../node-parser/pattern.ts';
import { parseUntilBlocks } from '../parse-root.ts';

const parseWhenDefault = (parserContext: ParserContext): Result<Node, TemplateError> => {
  skipSymbol(parserContext, '_');
  const advanceResult = advanceAfterBlockEnd(parserContext, 'when');
  if (isErr(advanceResult)) {
    return advanceResult;
  }
  return parseUntilBlocks(parserContext, 'endmatch');
};

const parseWhenPattern = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const patternNodeR = tryParsePattern(parserContext);
  if (isErr(patternNodeR)) {
    return patternNodeR;
  }
  if (patternNodeR.value !== null) {
    return ok(patternNodeR.value);
  }
  return parsePrimary(parserContext);
};

const parseWhenGuard = (parserContext: ParserContext): Result<Node | null, TemplateError> => {
  const afterPatternR = peekToken(parserContext);
  if (isErr(afterPatternR)) {
    return afterPatternR;
  }
  const afterPattern = afterPatternR.value;
  if (!(afterPattern.type === TOKEN_SYMBOL && afterPattern.value === 'if')) {
    return ok(null);
  }
  skipSymbol(parserContext, 'if');
  return parseExpression(parserContext);
};

const parseWhenBranch = (
  parserContext: ParserContext,
  tag: Token
): Result<WhenNode, TemplateError> => {
  const patternR = parseWhenPattern(parserContext);
  if (isErr(patternR)) {
    return patternR;
  }
  const guardR = parseWhenGuard(parserContext);
  if (isErr(guardR)) {
    return guardR;
  }
  const whenEndR = advanceAfterBlockEnd(parserContext, 'when');
  if (isErr(whenEndR)) {
    return whenEndR;
  }
  const bodyR = parseUntilBlocks(parserContext, 'when', 'endmatch');
  if (isErr(bodyR)) {
    return bodyR;
  }
  return ok(when(loc(tag), { pattern: patternR.value, body: bodyR.value, guard: guardR.value }));
};

type WhenIteration =
  | { readonly kind: 'when'; readonly node: WhenNode }
  | { readonly kind: 'default'; readonly node: Node };

const parseOneWhen = (
  parserContext: ParserContext,
  tag: Token
): Result<WhenIteration, TemplateError> => {
  skipSymbol(parserContext, 'when');
  const whenTokR = peekToken(parserContext);
  if (isErr(whenTokR)) {
    return whenTokR;
  }
  const whenTok = whenTokR.value;
  if (whenTok.type === TOKEN_SYMBOL && whenTok.value === '_') {
    const defaultR = parseWhenDefault(parserContext);
    if (isErr(defaultR)) {
      return defaultR;
    }
    return ok({ kind: 'default', node: defaultR.value });
  }
  const branchR = parseWhenBranch(parserContext, tag);
  if (isErr(branchR)) {
    return branchR;
  }
  return ok({ kind: 'when', node: branchR.value });
};

const parseMatchCases = (
  parserContext: ParserContext,
  tag: Token
): Result<{ cases: WhenNode[]; defaultCase: Node | null }, TemplateError> => {
  const collectCases = (
    accCases: WhenNode[]
  ): Result<{ cases: WhenNode[]; defaultCase: Node | null }, TemplateError> => {
    const peekR = peekToken(parserContext);
    if (isErr(peekR)) {
      return peekR;
    }
    const peeked = peekR.value;
    if (!(peeked.type === TOKEN_SYMBOL && peeked.value === 'when')) {
      return ok({ cases: accCases, defaultCase: null });
    }
    const oneR = parseOneWhen(parserContext, tag);
    if (isErr(oneR)) {
      return oneR;
    }
    const one = oneR.value;
    if (one.kind === 'default') {
      return ok({ cases: accCases, defaultCase: one.node });
    }
    return collectCases([...accCases, one.node]);
  };

  return collectCases([]);
};

export const parseMatch = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) {
    return tagR;
  }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'match')) {
    return fail(parserContext, 'Expected match', { lineno: tag.lineno, colno: tag.colno });
  }

  const exprR = parseExpression(parserContext);
  if (isErr(exprR)) {
    return exprR;
  }
  const headerEndR = advanceAfterBlockEnd(parserContext, 'match');
  if (isErr(headerEndR)) {
    return headerEndR;
  }

  const headerBodyR = parseUntilBlocks(parserContext, 'when', 'endmatch');
  if (isErr(headerBodyR)) {
    return headerBodyR;
  }

  const casesR = parseMatchCases(parserContext, tag);
  if (isErr(casesR)) {
    return casesR;
  }

  skipSymbol(parserContext, 'endmatch');
  const finalR = advanceAfterBlockEnd(parserContext, 'endmatch');
  if (isErr(finalR)) {
    return finalR;
  }

  return ok(
    match(loc(tag), {
      expr: exprR.value,
      cases: casesR.value.cases,
      default: casesR.value.defaultCase,
    })
  );
};
