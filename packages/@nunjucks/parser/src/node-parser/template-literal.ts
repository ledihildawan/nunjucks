import type { TemplateError } from '@nunjucks/error-formatter';
import { TOKEN_TEMPLATE_LITERAL } from '@nunjucks/lexer';
import { isErr, ok, type Result, SAFE_IDENTIFIER_RE } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { symbol, templateLiteral } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import { find, map } from 'remeda';
import type { ParserContext } from '../cursor.ts';
import { fail, nextToken } from '../cursor.ts';

// WHY: the shared SAFE_IDENTIFIER_RE SSOT (also enforced at the codegen boundary)
// instead of a parser-local pattern — the previous denylist missed
// `[ ] , ; " ' # @ % ^ ! ? & | < > ~` etc., so `a[0]` slipped through as a bogus
// symbol and failed (or rendered undefined) far from the documented parse-time error.
const isSafeTemplateExpression = (expr: string): boolean => SAFE_IDENTIFIER_RE.test(expr.trim());

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
    (quasi) => quasi.type === 'expression' && !isSafeTemplateExpression(quasi.value)
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
    quasi.type === 'expression'
      ? { type: 'expression' as const, node: symbol(loc(tok), quasi.value) }
      : { type: 'template' as const, value: quasi.value }
  );

  return ok(templateLiteral(loc(tok), processedQuasis));
};
