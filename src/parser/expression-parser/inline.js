import { nodes } from '../../nodes/index.js';
import { skipSymbol, skipValue } from '../cursor.js';
import { parseOr } from './logical.js';
import { TOKEN_OPERATOR, TOKEN_COLON } from '../../lexer/token-types.js';

const parseTernary = (ctx, node) => {
  if (skipValue(ctx, TOKEN_OPERATOR, '?')) {
    const thenNode = parseOr(ctx);
    if (skipValue(ctx, TOKEN_COLON, ':')) {
      const elseNode = parseOr(ctx);
      const newNode = nodes.inlineIf(node.lineno, node.colno);
      newNode.cond = node;
      newNode.body = thenNode;
      newNode.else_ = elseNode;
      return parseTernary(ctx, newNode);
    }
  }
  return node;
};

export const parseInlineIf = (ctx) => {
  let node = parseOr(ctx);

  if (skipSymbol(ctx, 'if')) {
    const condNode = parseOr(ctx);
    const bodyNode = node;
    node = nodes.inlineIf(node.lineno, node.colno);
    node.body = bodyNode;
    node.cond = condNode;
    if (skipSymbol(ctx, 'else')) {
      node.else_ = parseOr(ctx);
    } else {
      node.else_ = null;
    }
    return node;
  }

  return parseTernary(ctx, node);
};

export const parseExpression = (ctx) => parseInlineIf(ctx);
