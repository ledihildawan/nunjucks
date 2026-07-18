export const compileBlock = (ctx, node) => {
  const id = ctx._tmpid();
  ctx._emitLine(`let ${id} = await (await context.getBlock("${node.name.value}"))(env, context, frame, runtime);`);
  ctx._emitLine(`${ctx.buffer} += ${id};`);
};

export const compileSuper = (ctx, node, frame) => {
  const name = node.blockName.value;
  const id = node.symbol.value;

  ctx._emitLine(`lineno = ${node.lineno}; colno = ${node.colno};`);
  ctx._emitLine(`${id} = await context.getSuper(env, "${name}", b_${name}, frame, runtime, ${node.lineno}, ${node.colno});`);
  ctx._emitLine(`${id} = runtime.markSafe(${id});`);
  frame.set(id, id);
};
