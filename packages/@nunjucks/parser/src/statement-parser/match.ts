import type { Node, WhenNode } from '@nunjucks/nodes';
import { match, when } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { TOKEN_SYMBOL } from '@nunjucks/lexer';
import { parseExpression, parsePrimary } from "../expression-parser/index.ts";
import { tryParsePattern } from "../node-parser/pattern.ts";
import { parseUntilBlocks } from "../parse-root.ts";

export const parseMatch = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'match')) {
    fail(ctx, 'Expected match', tag.lineno, tag.colno);
  }

  const expr = parseExpression(ctx);
  advanceAfterBlockEnd(ctx, 'match');

  parseUntilBlocks(ctx, 'when', 'endmatch');

  const cases: WhenNode[] = [];
  let defaultCase: Node | null = null;

  let tok = peekToken(ctx);
  while (tok.type === TOKEN_SYMBOL && tok.value === 'when') {
    skipSymbol(ctx, 'when');
    const whenTok = peekToken(ctx);

    if (whenTok.type === TOKEN_SYMBOL && whenTok.value === '_') {
      skipSymbol(ctx, '_');
      advanceAfterBlockEnd(ctx, 'when');
      defaultCase = parseUntilBlocks(ctx, 'endmatch');
      break;
    }

    const patternNode = tryParsePattern(ctx);
    const pattern = patternNode ?? parsePrimary(ctx);

    const afterPattern = peekToken(ctx);
    const guard = (afterPattern.type === TOKEN_SYMBOL && afterPattern.value === 'if')
      ? ((): Node => { skipSymbol(ctx, 'if'); return parseExpression(ctx); })()
      : null;

    advanceAfterBlockEnd(ctx, 'when');
    const body = parseUntilBlocks(ctx, 'when', 'endmatch');

    cases.push(when(tag.lineno, tag.colno, pattern, body, guard));
    tok = peekToken(ctx);
  }

  skipSymbol(ctx, 'endmatch');
  advanceAfterBlockEnd(ctx, 'endmatch');

  return match(tag.lineno, tag.colno, { expr, cases, default: defaultCase });
};
