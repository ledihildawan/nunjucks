const compileUnary = (ctx, node, frame, operator) => {
  ctx._emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', ' + operator);
  ctx.compile(node.target, frame);
  ctx._emit(')');
};

export const compileNot = (ctx, node, frame) => compileUnary(ctx, node, frame, '!');

export const compileNeg = (ctx, node, frame) => compileUnary(ctx, node, frame, '-');

export const compilePos = (ctx, node, frame) => compileUnary(ctx, node, frame, '+');
