import { output, templateData } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { TOKEN_RAW } from '@nunjucks/lexer';
import { pipe } from 'remeda';
import { replace } from '@nunjucks/shared';

export const parseRaw = (ctx: ParserContext, tagName?: string): Node | null => {
  const tok = nextToken(ctx);

  if (!tok || tok.type !== TOKEN_RAW) {
    return null;
  }

  const rawContent = tok.value;
  const beginTag = tagName || 'raw';
  const endTag = `end${beginTag}`;
  const content = typeof rawContent === 'string'
    ? pipe(rawContent, replace(`{% ${beginTag} %}`, ''), replace(`{% ${endTag} %}`, ''))
    : rawContent;

  return output(
    tok.lineno,
    tok.colno,
    [templateData(tok.lineno, tok.colno, content as string)]
  );
};
