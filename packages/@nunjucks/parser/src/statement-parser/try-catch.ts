import { tryCatch } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Token } from '@nunjucks/lexer';
import { peekToken, skipValue, skipSymbol, nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseUntilBlocks } from "../top-level.ts";

export const parseTry = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'try')) { fail(ctx, 'expected try', tag.lineno, tag.colno); }

  const tok = nextToken(ctx);
  if (tok && tok.type === 'block-end') {
    // consumed block end
  }

  const body = parseUntilBlocks(ctx, 'catch', 'endtry');

  let catchBody: Node | null = null;
  let errVar: string | null = null;

  if (peekToken(ctx).value === 'catch') {
    skipSymbol(ctx, 'catch');

    const catchEnd = nextToken(ctx);
    if (catchEnd && catchEnd.type === 'block-end') {
      // consumed block end
    }

    if (peekToken(ctx).type === 'symbol') {
      const errToken = nextToken(ctx);
      if (typeof errToken.value === 'string') {
        errVar = errToken.value;
      }
    }

    catchBody = parseUntilBlocks(ctx, 'endtry');
  }

  if (peekToken(ctx).value === 'endtry') {
    skipSymbol(ctx, 'endtry');

    const endTok = nextToken(ctx);
    if (endTok && endTok.type === 'block-end') {
      // consumed block end
    }
  } else {
    fail(ctx, 'expected endtry, got ' + peekToken(ctx).value);
  }

  return tryCatch(tag.lineno, tag.colno, body, catchBody, errVar);
};
