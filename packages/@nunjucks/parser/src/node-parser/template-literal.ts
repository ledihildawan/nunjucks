import type { TemplateError } from '@nunjucks/error-formatter';
import { TOKEN_TEMPLATE_LITERAL } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { symbol, templateLiteral } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import { find, map } from 'remeda';
import type { ParserContext } from '../cursor.ts';
import { fail, nextToken } from '../cursor.ts';

// WHY: positive identifier check (matching the codegen boundary's SAFE_IDENTIFIER_RE)
// instead of the previous denylist — the denylist missed `[ ] , ; " ' # @ % ^ ! ? & | < > ~`
// etc., so `a[0]` slipped through as a bogus symbol and failed (or rendered undefined)
// far from the documented parse-time error.
const SIMPLE_IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/u;

const isSafeTemplateExpression = (expr: string): boolean => {
  if (!expr) {
    return true;
  }
  const trimmed = expr.trim();
  if (!trimmed) {
    return true;
  }
  return SIMPLE_IDENTIFIER_PATTERN.test(trimmed);
};

/**
 * Parses a backtick template literal token into quasi parts, rejecting
 * interpolations that are anything but simple identifiers.
 */
export const parseTemplateLiteral = (
  parserContext: ParserContext
): Result<Node | null, TemplateError> => {
  const tokR = nextToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;

  if (tok.type !== TOKEN_TEMPLATE_LITERAL) {
    return ok(null);
  }

  const quasis = tok.value.quasis ?? [];

  const unsafe = find(
    quasis,
    (quasi) =>
      quasi.type === 'expression' && Boolean(quasi.value) && !isSafeTemplateExpression(quasi.value)
  );
  if (unsafe) {
    return fail(parserContext, {
      message:
        'Template literal expressions must be simple identifiers only. ' +
        'Complex expressions like "${' +
        unsafe.value +
        '}" are not allowed. ' +
        'Use filters or `:=` declarations for complex computations.',
      lineno: tok.lineno,
      colno: tok.colno,
    });
  }

  const processedQuasis = map(quasis, (quasi) =>
    quasi.type === 'expression' && quasi.value
      ? { type: 'expression' as const, node: symbol(loc(tok), quasi.value) }
      : { type: 'template' as const, value: quasi.value }
  );

  return ok(templateLiteral(loc(tok), processedQuasis));
};
