import { FunCall } from '../../nodes.js';

export const parseFunCall = (ctx, tok, target) => {
  return new FunCall(tok.lineno, tok.colno, target, ctx.parseSignature());
};
