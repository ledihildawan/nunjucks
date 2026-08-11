import { TOKEN_TEMPLATE_LITERAL } from '@nunjucks/lexer';
import { symbol, templateLiteral } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { loc } from '@nunjucks/shared';
import { find, map } from 'remeda';

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

export const parseTemplateLiteral = (parserContext: ParserContext): Result<Node | null, TemplateError> => {
  const tokR = nextToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;

  if (tok.type !== TOKEN_TEMPLATE_LITERAL) {
    return ok(null);
  }

  const quasis = tok.value.quasis ?? [];

  const unsafe = find(quasis, quasi =>
    quasi.type === 'expression' && Boolean(quasi.value) && !isSafeTemplateExpression(quasi.value));
  if (unsafe) {
    return fail(parserContext, 'Template literal expressions must be simple identifiers only. ' +
      'Complex expressions like "${' + unsafe.value + '}" are not allowed. ' +
      'Use filters or `:=` declarations for complex computations.', { lineno: tok.lineno, colno: tok.colno });
  }

  const processedQuasis = map(quasis, quasi =>
    quasi.type === 'expression' && quasi.value
      ? { type: 'expression' as const, node: symbol(loc(tok), quasi.value) }
      : { type: 'template' as const, value: quasi.value }
  );

  return ok(templateLiteral(loc(tok), processedQuasis));
};
