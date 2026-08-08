import { TOKEN_TEMPLATE_LITERAL } from '@nunjucks/lexer';
import { symbol, templateLiteral } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { map, pipe } from 'remeda';
import { nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";

const SIMPLE_IDENTIFIER_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

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

export const parseTemplateLiteral = (parserContext: ParserContext): Node | null => {
  const tok = nextToken(parserContext);

  if (tok.type !== TOKEN_TEMPLATE_LITERAL) {
    return null;
  }

  const quasis = tok.value.quasis ?? [];

  const processedQuasis = pipe(quasis, map(quasi => {
    if (quasi.type === 'expression' && quasi.value) {
      if (!isSafeTemplateExpression(quasi.value)) {
        fail(parserContext, 'Template literal expressions must be simple identifiers only. ' +
          'Complex expressions like "${' + quasi.value + '}" are not allowed. ' +
          'Use filters or `:=` declarations for complex computations.',
          tok.lineno, tok.colno);
      }
      const exprNode = symbol(tok.lineno, tok.colno, quasi.value);
      return { type: 'expression' as const, node: exprNode };
    }
    return { type: 'template' as const, value: quasi.value };
  }));

  return templateLiteral(tok.lineno, tok.colno, processedQuasis);
};
