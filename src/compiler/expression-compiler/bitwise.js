const compileBinaryBitwise = (ctx, node, frame, operator) => {
  ctx._emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', ');
  ctx.compile(node.left, frame);
  ctx._emit(' ' + operator + ' ');
  ctx.compile(node.right, frame);
  ctx._emit(')');
};

export const compileBitwiseOr = (ctx, node, frame) => compileBinaryBitwise(ctx, node, frame, '|');
export const compileBitwiseAnd = (ctx, node, frame) => compileBinaryBitwise(ctx, node, frame, '&');
export const compileBitwiseXor = (ctx, node, frame) => compileBinaryBitwise(ctx, node, frame, '^');
export const compileBitwiseLShift = (ctx, node, frame) => compileBinaryBitwise(ctx, node, frame, '<<');
export const compileBitwiseRShift = (ctx, node, frame) => compileBinaryBitwise(ctx, node, frame, '>>');

export const compileBitwiseNot = (ctx, node, frame) => {
  ctx._emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', ~');
  ctx.compile(node.target, frame);
  ctx._emit(')');
};
