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
  const first = node.ops[0] ?? node;
  ctx._emit('(lineno = ' + (first.lineno ?? node.lineno ?? 0) + ', colno = ' + (first.colno ?? node.colno ?? 0) + ', ');
  ctx.compile(node.expr, frame);

  node.ops.forEach((op) => {
    ctx._emit(` ${compareOps[op.operator]} (lineno = ${op.lineno ?? node.lineno ?? 0}, colno = ${op.colno ?? node.colno ?? 0}, `);
    ctx.compile(op.expr, frame);
    ctx._emit(')');
  });
  ctx._emit(')');
};

export const compileIs = (ctx, node, frame) => {
  const right = node.right.name
    ? node.right.name.value
    : node.right.value;
  const lineno = node.lineno ?? 0;
  const colno = node.colno ?? 0;
  ctx._emit('(lineno = ' + lineno + ', colno = ' + colno + ', env.getTest(' + JSON.stringify(String(right)) + ', ' + lineno + ', ' + colno + ').call(context, ');
  ctx.compile(node.left, frame);
  if (node.right.args) {
    ctx._emit(',');
    ctx.compile(node.right.args, frame);
  }
  ctx._emit(') === true)');
};
