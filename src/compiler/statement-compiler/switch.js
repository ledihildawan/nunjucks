export const compileSwitch = (ctx, node, frame) => {
  ctx._emit('switch (');
  ctx.compile(node.expr, frame);
  ctx._emit(') {');
  node.cases.forEach((c) => {
    ctx._emit('case ');
    ctx.compile(c.cond, frame);
    ctx._emit(': ');
    ctx.compile(c.body, frame);
    if (c.body.children.length) {
      ctx._emitLine('break;');
    }
  });
  if (node.default) {
    ctx._emit('default:');
    ctx.compile(node.default, frame);
  }
  ctx._emit('}');
};
