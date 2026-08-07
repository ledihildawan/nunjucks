import type { Node, WhenNode } from '@nunjucks/nodes';
import { match, when } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { TOKEN_SYMBOL } from '@nunjucks/lexer';
import { parseExpression, parsePrimary } from "../expression-parser/index.ts";
import { tryParsePattern } from "../node-parser/pattern.ts";
import { parseUntilBlocks } from "../parse-root.ts";

export const parseMatch = (parserContext: ParserContext): Node => {
  const tag = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'match')) {
    fail(parserContext, 'Expected match', tag.lineno, tag.colno);
  }

  const expr = parseExpression(parserContext);
  advanceAfterBlockEnd(parserContext, 'match');

  parseUntilBlocks(parserContext, 'when', 'endmatch');

  const cases: WhenNode[] = [];
  let defaultCase: Node | null = null;

  let tok = peekToken(parserContext);
  while (tok.type === TOKEN_SYMBOL && tok.value === 'when') {
    skipSymbol(parserContext, 'when');
    const whenTok = peekToken(parserContext);

    if (whenTok.type === TOKEN_SYMBOL && whenTok.value === '_') {
      skipSymbol(parserContext, '_');
      advanceAfterBlockEnd(parserContext, 'when');
      defaultCase = parseUntilBlocks(parserContext, 'endmatch');
      break;
    }

    const patternNode = tryParsePattern(parserContext);
    const pattern = patternNode ?? parsePrimary(parserContext);

    const afterPattern = peekToken(parserContext);
    const guard = (afterPattern.type === TOKEN_SYMBOL && afterPattern.value === 'if')
      ? ((): Node => { skipSymbol(parserContext, 'if'); return parseExpression(parserContext); })()
      : null;

    advanceAfterBlockEnd(parserContext, 'when');
    const body = parseUntilBlocks(parserContext, 'when', 'endmatch');

    cases.push(when(tag.lineno, tag.colno, pattern, body, guard));
    tok = peekToken(parserContext);
  }

  skipSymbol(parserContext, 'endmatch');
  advanceAfterBlockEnd(parserContext, 'endmatch');

  return match(tag.lineno, tag.colno, { expr, cases, default: defaultCase });
};
