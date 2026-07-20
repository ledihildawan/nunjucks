export const compileSwitch = (ctx, node, frame) => {
  ctx._emit('switch (');
  ctx.compile(node.expr, frame);
  ctx._emitLine(') {');
  node.cases.forEach((c) => {
    ctx._emit('case ');
    ctx.compile(c.cond, frame);
    ctx._emitLine(':');
    ctx._withScopedSyntax(() => {
      ctx._emitLine('frame = frame.push(true);');
      ctx.compile(c.body, frame);
      ctx._emitLine('frame = frame.pop();');
    });
    if (c.body.children.length) {
      ctx._emitLine('break;');
    }
  });
  if (node.default) {
    ctx._emitLine('default:');
    ctx._withScopedSyntax(() => {
      ctx._emitLine('frame = frame.push(true);');
      ctx.compile(node.default, frame);
      ctx._emitLine('frame = frame.pop();');
    });
  }
  ctx._emitLine('}');
};
