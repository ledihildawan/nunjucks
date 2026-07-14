export const compileBlock = (ctx, node) => {
  const id = ctx._tmpid();
  ctx._emitLine(`let ${id} = await (await ctx.getBlock("${node.name.value}"))(env, ctx, frame, rt);`);
  ctx._emitLine(`${ctx.buffer} += ${id};`);
};

export const compileSuper = (ctx, node, frame) => {
  const name = node.blockName.value;
  const id = node.symbol.value;

  ctx._emitLine(`${id} = await ctx.getSuper(env, "${name}", b_${name}, frame, rt);`);
  ctx._emitLine(`${id} = rt.markSafe(${id});`);
  frame.set(id, id);
};
