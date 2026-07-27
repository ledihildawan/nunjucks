import { TOKEN_TEMPLATE_LITERAL } from '@nunjucks/lexer';
import { symbol, templateLiteral } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";

const SIMPLE_IDENTIFIER_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

interface Quasi {
  type: string;
  value: string;
}

const UNSAFE_CHARS = ['(', ')', '=>', '{', '+', '-', '*', '/', '||', '&&', '??', '=', ':', '.'] as const;
const UNSAFE_PATTERNS = [/^\d/, /\s/];

const isSafeTemplateExpression = (expr: string): boolean => {
  if (!expr) { return true; }
  const trimmed = expr.trim();
  if (!trimmed) { return true; }
  if (SIMPLE_IDENTIFIER_PATTERN.test(trimmed)) { return true; }
  if (UNSAFE_PATTERNS.some(p => p.test(trimmed))) { return false; }
  if (UNSAFE_CHARS.some(c => trimmed.includes(c))) { return false; }
  return true;
};

export const parseTemplateLiteral = (ctx: ParserContext): Node | null => {
  const tok = nextToken(ctx);

  if (tok.type !== TOKEN_TEMPLATE_LITERAL) {
    return null;
  }

  const templateData = tok.value as { quasis?: Quasi[] };
  const quasis = templateData.quasis || [];

  const processedQuasis: { type: string; node?: Node; value?: string }[] = [];

  for (const quasi of quasis) {
    if (quasi.type === 'expression' && quasi.value) {
      if (!isSafeTemplateExpression(quasi.value)) {
        fail(ctx, 'Template literal expressions must be simple identifiers only. ' +
          'Complex expressions like "${' + quasi.value + '}" are not allowed. ' +
          'Use filters or set statements for complex computations.',
          tok.lineno, tok.colno);
      }
      const exprNode = symbol(tok.lineno, tok.colno, quasi.value);
      processedQuasis.push({ type: 'expression', node: exprNode });
    } else {
      processedQuasis.push({ type: 'template', value: quasi.value });
    }
  }

  return templateLiteral(tok.lineno, tok.colno, processedQuasis);
};
