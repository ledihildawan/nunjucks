export const compileDo = (ctx, node, frame) => {
  ctx._emit('(');
  ctx._compileExpression(node.expr, frame);
  ctx._emitLine(');');
};
