export const compileWith = (ctx, node, frame) => {
  ctx._emitLine('frame = frame.push(true);');

  ctx._withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });

  ctx._emitLine('frame = frame.pop();');
};
