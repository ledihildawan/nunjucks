export const compileBlock = (ctx, node) => {
  const id = ctx._tmpid();
  const emit = () => {
    ctx._emitLine(`var ${id} = await (await context.getBlock("${node.name.value}"))(env, context, frame, runtime);`);
    ctx._emitLine(`${ctx.buffer} += ${id};`);
  };
  if (!ctx.inBlock) {
    ctx._emitLine(`if(!parentTemplate) {`);
    emit();
    ctx._emitLine(`}`);
  } else {
    emit();
  }
};

export const compileSuper = (ctx, node, frame) => {
  const name = node.blockName.value;
  const id = node.symbol.value;

  ctx._emitLine(`${id} = await context.getSuper(env, "${name}", b_${name}, frame, runtime);`);
  ctx._emitLine(`${id} = runtime.markSafe(${id});`);
  frame.set(id, id);
};
