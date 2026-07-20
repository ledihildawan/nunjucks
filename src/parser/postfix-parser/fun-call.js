import { nodes } from '../../nodes/index.js';

export const parseFunCall = (ctx, tok, target) => {
  return nodes.funCall(tok.lineno, tok.colno, target, ctx.parseSignature());
};
