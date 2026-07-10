import { FunCall } from '../../nodes/index.js';

export const parseFunCall = (ctx, tok, target) => {
  return FunCall(tok.lineno, tok.colno, target, ctx.parseSignature());
};
