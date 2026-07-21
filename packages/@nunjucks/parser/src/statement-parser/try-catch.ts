import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Token } from '@nunjucks/lexer';
import { peekToken, skipValue, skipSymbol, nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseUntilBlocks } from "../top-level.ts";

export const parseTry = (ctx: ParserContext): Node => {
  const tag = skipSymbol(ctx, 'try') as unknown as { lineno: number; colno: number };

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

    if (peekToken(ctx).type === ctx.TOKEN_SYMBOL) {
      errVar = ((skipValue(ctx, ctx.TOKEN_SYMBOL as Token['type']) as unknown as Token).value) as string;
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

  return nodes.tryCatch(tag.lineno, tag.colno, body, catchBody, errVar);
};
