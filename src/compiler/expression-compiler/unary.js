export const compileNot = (ctx, node, frame) => {
  ctx._emit('!');
  ctx.compile(node.target, frame);
};

export const compileNeg = (ctx, node, frame) => {
  ctx._emit('-');
  ctx.compile(node.target, frame);
};

export const compilePos = (ctx, node, frame) => {
  ctx._emit('+');
  ctx.compile(node.target, frame);
};
