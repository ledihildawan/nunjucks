const binOpEmitter = (ctx, node, frame, str) => {
  ctx.compile(node.left, frame);
  ctx._emit(str);
  ctx.compile(node.right, frame);
};

export const compileOr = (ctx, node, frame) => binOpEmitter(ctx, node, frame, ' || ');

export const compileAnd = (ctx, node, frame) => binOpEmitter(ctx, node, frame, ' && ');

export const compileAdd = (ctx, node, frame) => binOpEmitter(ctx, node, frame, ' + ');

export const compileConcat = (ctx, node, frame) => binOpEmitter(ctx, node, frame, ' + "" + ');

export const compileSub = (ctx, node, frame) => binOpEmitter(ctx, node, frame, ' - ');

export const compileMul = (ctx, node, frame) => binOpEmitter(ctx, node, frame, ' * ');

export const compileDiv = (ctx, node, frame) => binOpEmitter(ctx, node, frame, ' / ');

export const compileMod = (ctx, node, frame) => binOpEmitter(ctx, node, frame, ' % ');

export const compileNullishCoalesce = (ctx, node, frame) => {
  ctx._emit('runtime.nullishCoalesce(');
  ctx.compile(node.left, frame);
  ctx._emit(',');
  ctx.compile(node.right, frame);
  ctx._emit(')');
};

export const compileIn = (ctx, node, frame) => {
  ctx._emit('runtime.inOperator(');
  ctx.compile(node.left, frame);
  ctx._emit(',');
  ctx.compile(node.right, frame);
  ctx._emit(')');
};

export const compileFloorDiv = (ctx, node, frame) => {
  ctx._emit('Math.floor(');
  ctx.compile(node.left, frame);
  ctx._emit(' / ');
  ctx.compile(node.right, frame);
  ctx._emit(')');
};

export const compilePow = (ctx, node, frame) => {
  ctx._emit('Math.pow(');
  ctx.compile(node.left, frame);
  ctx._emit(', ');
  ctx.compile(node.right, frame);
  ctx._emit(')');
};
