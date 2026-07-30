import { tryCatch } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { TOKEN_BLOCK_END } from '@nunjucks/lexer';
import { peekToken, skipSymbol, nextToken, pushToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseUntilBlocks } from "../top-level.ts";

const skipBlockEnd = (ctx: ParserContext): void => {
  const tok = nextToken(ctx);
  if (tok && tok.type !== TOKEN_BLOCK_END) {
    pushToken(ctx, tok);
  }
};

const parseCatchBlock = (ctx: ParserContext): { catchBody: Node | null; errVar: string | null } => {
  skipSymbol(ctx, 'catch');
  skipBlockEnd(ctx);

  const isErrSymbol = peekToken(ctx).type === 'symbol';
  const errToken = isErrSymbol ? nextToken(ctx) : null;
  const errVar = errToken && typeof errToken.value === 'string' ? errToken.value : null;

  const catchBody = parseUntilBlocks(ctx, 'endtry');
  return { catchBody, errVar };
};

export const parseTry = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'try')) { fail(ctx, 'expected try', tag.lineno, tag.colno); }

  skipBlockEnd(ctx);

  const body = parseUntilBlocks(ctx, 'catch', 'endtry');

  const catchResult = peekToken(ctx).value === 'catch' ? parseCatchBlock(ctx) : null;
  const catchBody = catchResult?.catchBody ?? null;
  const errVar = catchResult?.errVar ?? null;

  if (peekToken(ctx).value === 'endtry') {
    skipSymbol(ctx, 'endtry');
    skipBlockEnd(ctx);
  } else {
    fail(ctx, `expected endtry, got ${peekToken(ctx).value}`);
  }

  return tryCatch(tag.lineno, tag.colno, { body, catchBody, errVar });
};
