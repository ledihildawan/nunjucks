const emitLocation = (ctx, node) => {
  ctx._emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', ');
};

const binOpEmitter = (ctx, node, frame, str) => {
  emitLocation(ctx, node);
  ctx.compile(node.left, frame);
  ctx._emit(str);
  ctx.compile(node.right, frame);
  ctx._emit(')');
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
  emitLocation(ctx, node);
  ctx.compile(node.left, frame);
  ctx._emit(' ?? ');
  ctx.compile(node.right, frame);
  ctx._emit(')');
};

export const compileIn = (ctx, node, frame) => {
  const lineno = node.lineno ?? 0;
  const colno = node.colno ?? 0;
  ctx._emit('(lineno = ' + lineno + ', colno = ' + colno + ', runtime.inOperator(');
  ctx.compile(node.left, frame);
  ctx._emit(',');
  ctx.compile(node.right, frame);
  ctx._emit(', ' + lineno + ', ' + colno + '))');
};

export const compileFloorDiv = (ctx, node, frame) => {
  emitLocation(ctx, node);
  ctx._emit('Math.floor(');
  ctx.compile(node.left, frame);
  ctx._emit(' / ');
  ctx.compile(node.right, frame);
  ctx._emit('))');
};

export const compilePow = (ctx, node, frame) => {
  emitLocation(ctx, node);
  ctx._emit('Math.pow(');
  ctx.compile(node.left, frame);
  ctx._emit(', ');
  ctx.compile(node.right, frame);
  ctx._emit('))');
};
