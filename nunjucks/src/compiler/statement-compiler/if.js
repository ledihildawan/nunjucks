export const compileIf = (ctx, node, frame) => {
  ctx._emit('if(');
  ctx._compileExpression(node.cond, frame);
  ctx._emitLine(') {');

  ctx._withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });

  if (node.else_) {
    ctx._emitLine('}\nelse {');

    ctx._withScopedSyntax(() => {
      ctx.compile(node.else_, frame);
    });
  }

  ctx._emitLine('}');
};

export const compileIfAsync = (ctx, node, frame) => {
  ctx._emit('await (async function() {');
  compileIf(ctx, node, frame, true);
  ctx._emit('})();');
};
