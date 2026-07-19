import { nodes } from '../../nodes/index.js';
import { nextToken, pushToken } from '../cursor.js';
import { parseIs } from './is.js';

const bitwiseNodeMap = {
  '|': nodes.bitwiseOr,
  '&': nodes.bitwiseAnd,
  '^': nodes.bitwiseXor,
  '<<': nodes.bitwiseLShift,
  '>>': nodes.bitwiseRShift
};

export const parseBitwiseOr = (ctx) => {
  let node = parseIs(ctx);
  let tok = nextToken(ctx);

  if (!tok) {
    return node;
  }

  const createNode = bitwiseNodeMap[tok.value];
  if (createNode) {
    const right = parseIs(ctx);
    node = createNode(tok.lineno, tok.colno, node, right);
  } else {
    pushToken(ctx, tok);
  }

  return node;
};
