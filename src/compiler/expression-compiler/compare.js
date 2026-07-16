const compareOps = {
  '==': '==',
  '===': '===',
  '!=': '!=',
  '!==': '!==',
  '<': '<',
  '>': '>',
  '<=': '<=',
  '>=': '>='
};

export const compileCompare = (ctx, node, frame) => {
  ctx.compile(node.expr, frame);

  node.ops.forEach((op) => {
    ctx._emit(` ${compareOps[op.operator]} `);
    ctx.compile(op.expr, frame);
  });
};

export const compileIs = (ctx, node, frame) => {
  const right = node.right.name
    ? node.right.name.value
    : node.right.value;
  ctx._emit('env.getTest("' + right + '").call(context, ');
  ctx.compile(node.left, frame);
  if (node.right.args) {
    ctx._emit(',');
    ctx.compile(node.right.args, frame);
  }
  ctx._emit(') === true');
};
