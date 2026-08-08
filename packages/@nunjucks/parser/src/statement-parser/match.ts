import type { Node, WhenNode } from '@nunjucks/nodes';
import { match, when } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { TOKEN_SYMBOL } from '@nunjucks/lexer';
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parseExpression, parsePrimary } from "../expression-parser/index.ts";
import { tryParsePattern } from "../node-parser/pattern.ts";
import { parseUntilBlocks } from "../parse-root.ts";
import { loc } from '@nunjucks/shared';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Result unwrap-and-return short-circuits inflate branching
export const parseMatch = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'match')) {
    return fail(parserContext, 'Expected match', tag.lineno, tag.colno);
  }

  const exprR = parseExpression(parserContext);
  if (isErr(exprR)) { return exprR; }
  const headerEndR = advanceAfterBlockEnd(parserContext, 'match');
  if (isErr(headerEndR)) { return headerEndR; }

  const headerBodyR = parseUntilBlocks(parserContext, 'when', 'endmatch');
  if (isErr(headerBodyR)) { return headerBodyR; }

  const cases: WhenNode[] = [];
  let defaultCase: Node | null = null;

  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  let tok = tokR.value;
  while (tok.type === TOKEN_SYMBOL && tok.value === 'when') {
    skipSymbol(parserContext, 'when');
    const whenTokR = peekToken(parserContext);
    if (isErr(whenTokR)) { return whenTokR; }
    const whenTok = whenTokR.value;

    if (whenTok.type === TOKEN_SYMBOL && whenTok.value === '_') {
      skipSymbol(parserContext, '_');
      const aR = advanceAfterBlockEnd(parserContext, 'when');
      if (isErr(aR)) { return aR; }
      const defaultBodyR = parseUntilBlocks(parserContext, 'endmatch');
      if (isErr(defaultBodyR)) { return defaultBodyR; }
      defaultCase = defaultBodyR.value;
      break;
    }

    const patternNodeR = tryParsePattern(parserContext);
    if (isErr(patternNodeR)) { return patternNodeR; }
    let pattern: Node;
    if (patternNodeR.value !== null) {
      pattern = patternNodeR.value;
    } else {
      const primR = parsePrimary(parserContext);
      if (isErr(primR)) { return primR; }
      pattern = primR.value;
    }

    const afterPatternR = peekToken(parserContext);
    if (isErr(afterPatternR)) { return afterPatternR; }
    const afterPattern = afterPatternR.value;
    let guard: Node | null = null;
    if (afterPattern.type === TOKEN_SYMBOL && afterPattern.value === 'if') {
      skipSymbol(parserContext, 'if');
      const guardR = parseExpression(parserContext);
      if (isErr(guardR)) { return guardR; }
      guard = guardR.value;
    }

    const whenEndR = advanceAfterBlockEnd(parserContext, 'when');
    if (isErr(whenEndR)) { return whenEndR; }
    const bodyR = parseUntilBlocks(parserContext, 'when', 'endmatch');
    if (isErr(bodyR)) { return bodyR; }

    cases.push(when(loc(tag), { pattern, body: bodyR.value, guard }));
    const nextTokR = peekToken(parserContext);
    if (isErr(nextTokR)) { return nextTokR; }
    tok = nextTokR.value;
  }

  skipSymbol(parserContext, 'endmatch');
  const finalR = advanceAfterBlockEnd(parserContext, 'endmatch');
  if (isErr(finalR)) { return finalR; }

  return ok(match(loc(tag), { expr: exprR.value, cases, default: defaultCase }));
};
