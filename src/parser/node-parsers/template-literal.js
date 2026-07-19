import { TOKEN_TEMPLATE_LITERAL } from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { nextToken } from '../cursor.js';

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
      const exprNode = nodes.symbol(tok.lineno, tok.colno, quasi.value);
      processedQuasis.push({ type: 'expression', node: exprNode });
    } else {
      processedQuasis.push({ type: 'template', value: quasi.value });
    }
  }

  return nodes.templateLiteral(tok.lineno, tok.colno, processedQuasis);
};
