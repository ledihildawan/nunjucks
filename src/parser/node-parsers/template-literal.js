import { TOKEN_TEMPLATE_LITERAL } from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { nextToken, fail } from '../cursor.js';

const SIMPLE_IDENTIFIER_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

const isSafeTemplateExpression = (expr) => {
  if (!expr) return true;
  const trimmed = expr.trim();
  if (!trimmed) return true;
  if (SIMPLE_IDENTIFIER_PATTERN.test(trimmed)) return true;
  if (trimmed.includes('(') || trimmed.includes('=>') || trimmed.includes('{')) return false;
  if (trimmed.includes('+') || trimmed.includes('-') || trimmed.includes('*') || trimmed.includes('/')) return false;
  if (trimmed.includes('||') || trimmed.includes('&&') || trimmed.includes('??')) return false;
  if (trimmed.includes('=') || trimmed.includes(':')) return false;
  if (trimmed.includes('.')) return false;
  return true;
};

export const parseTemplateLiteral = (ctx) => {
  const tok = nextToken(ctx);

  if (tok.type !== TOKEN_TEMPLATE_LITERAL) {
    return null;
  }

  const templateData = tok.value;
  const quasis = templateData.quasis || [];

  const processedQuasis = [];

  for (const quasi of quasis) {
    if (quasi.type === 'expression' && quasi.value) {
      if (!isSafeTemplateExpression(quasi.value)) {
        fail(ctx, 'Template literal expressions must be simple identifiers only. ' +
          'Complex expressions like "${' + quasi.value + '}" are not allowed. ' +
          'Use filters or set statements for complex computations.',
          tok.lineno, tok.colno);
      }
      const exprNode = nodes.symbol(tok.lineno, tok.colno, quasi.value);
      processedQuasis.push({ type: 'expression', node: exprNode });
    } else {
      processedQuasis.push({ type: 'template', value: quasi.value });
    }
  }

  return nodes.templateLiteral(tok.lineno, tok.colno, processedQuasis);
};
