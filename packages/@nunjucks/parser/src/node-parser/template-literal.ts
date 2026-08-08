import { TOKEN_TEMPLATE_LITERAL } from '@nunjucks/lexer';
import { symbol, templateLiteral } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { loc } from '@nunjucks/shared';

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

  const processedQuasis: Array<{ type: 'template'; value: string } | { type: 'expression'; node: Node }> = [];
  for (const quasi of quasis) {
    if (quasi.type === 'expression' && quasi.value) {
      if (!isSafeTemplateExpression(quasi.value)) {
        return fail(parserContext, 'Template literal expressions must be simple identifiers only. ' +
          'Complex expressions like "${' + quasi.value + '}" are not allowed. ' +
          'Use filters or `:=` declarations for complex computations.',
          tok.lineno, tok.colno);
      }
      const exprNode = symbol(loc(tok), quasi.value);
      processedQuasis.push({ type: 'expression', node: exprNode });
    } else {
      processedQuasis.push({ type: 'template', value: quasi.value });
    }
  }

  return ok(templateLiteral(loc(tok), processedQuasis));
};
