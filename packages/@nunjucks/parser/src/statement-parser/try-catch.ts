import { tryCatch } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseUntilBlocks } from "../top-level.ts";

const skipBlockEnd = (ctx: ParserContext): void => {
  const tok = nextToken(ctx);
  if (tok && tok.type !== 'block-end') {
    // put it back if not a block-end
  }
};

const parseCatchBlock = (ctx: ParserContext): { catchBody: Node | null; errVar: string | null } => {
  skipSymbol(ctx, 'catch');
  skipBlockEnd(ctx);

  let errVar: string | null = null;
  if (peekToken(ctx).type === 'symbol') {
    const errToken = nextToken(ctx);
    if (typeof errToken.value === 'string') {
      errVar = errToken.value;
    }
  }

  const catchBody = parseUntilBlocks(ctx, 'endtry');
  return { catchBody, errVar };
};

export const parseTry = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'try')) { fail(ctx, 'expected try', tag.lineno, tag.colno); }

  skipBlockEnd(ctx);

  const body = parseUntilBlocks(ctx, 'catch', 'endtry');

  let catchBody: Node | null = null;
  let errVar: string | null = null;

  if (peekToken(ctx).value === 'catch') {
    const result = parseCatchBlock(ctx);
    catchBody = result.catchBody;
    errVar = result.errVar;
  }

  if (peekToken(ctx).value === 'endtry') {
    skipSymbol(ctx, 'endtry');
    skipBlockEnd(ctx);
  } else {
    fail(ctx, `expected endtry, got ${peekToken(ctx).value}`);
  }

  return tryCatch(tag.lineno, tag.colno, { body, catchBody, errVar });
};
