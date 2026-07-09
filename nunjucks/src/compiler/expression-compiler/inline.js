export const compileInlineIf = (ctx, node, frame) => {
  ctx._emit('(');
  ctx.compile(node.cond, frame);
  ctx._emit('?');
  ctx.compile(node.body, frame);
  ctx._emit(':');
  if (node.else_ !== null) {
    ctx.compile(node.else_, frame);
  } else {
    ctx._emit('""');
  }
  ctx._emit(')');
};
