export const compileWith = (ctx, node, frame) => {
  ctx._emitLine('frame = frame.push(true);');

  // Set inline assignments in the isolated frame
  if (node.assignments && node.assignments.length > 0) {
    node.assignments.forEach((pair) => {
      const name = pair.key;
      const valueId = ctx._tmpid();
      ctx._emitLine('let ' + valueId + ' = ');
      ctx._compileExpression(pair.value, frame);
      ctx._emitLine(';');
      ctx._emitLine('frame.set("' + name + '", ' + valueId + ', true);');
    });
  }

  ctx._withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });

  ctx._emitLine('frame = frame.pop();');
};
