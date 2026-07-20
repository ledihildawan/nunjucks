export const compileIf = (ctx, node, frame) => {
  ctx._emit('if(');
  ctx._compileExpression(node.cond, frame);
  ctx._emitLine(') {');

  ctx._withScopedSyntax(() => {
    ctx._emitLine('frame = frame.push(true);');
    ctx.compile(node.body, frame);
    ctx._emitLine('frame = frame.pop();');
  });

  if (node.else_) {
    ctx._emitLine('}\nelse {');

    ctx._withScopedSyntax(() => {
      ctx._emitLine('frame = frame.push(true);');
      ctx.compile(node.else_, frame);
      ctx._emitLine('frame = frame.pop();');
    });
  }

  ctx._emitLine('}');
};
