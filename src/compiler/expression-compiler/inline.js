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

export const compileWalrus = (ctx, node, frame) => {
  const targetName = node.target.value;
  ctx._emit('((' + targetName + '=');
  ctx.compile(node.value, frame);
  ctx._emit('), ' + targetName + ')');
};
