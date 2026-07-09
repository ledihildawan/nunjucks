export const compileSet = (ctx, node, frame) => {
  const ids = [];

  node.targets.forEach((target) => {
    const name = target.value;
    let id = frame.lookup(name);

    if (id === null || id === undefined) {
      id = ctx._tmpid();
      ctx._emitLine('var ' + id + ';');
    }

    ids.push(id);
  });

  if (node.value) {
    const op = node.operator || '=';
    ctx._emit(ids.join(' = ') + ' ' + op + ' ');
    ctx._compileExpression(node.value, frame);
    ctx._emitLine(';');
  } else {
    ctx._emit(ids.join(' = ') + ' = await ');
    ctx.compile(node.body, frame);
    ctx._emitLine(';');
  }

  node.targets.forEach((target, i) => {
    const id = ids[i];
    const name = target.value;

    ctx._emitLine(`frame.set("${name}", ${id}, true);`);

    ctx._emitLine('if(frame.topLevel) {');
    ctx._emitLine(`context.setVariable("${name}", ${id});`);
    ctx._emitLine('}');

    if (name.charAt(0) !== '_') {
      ctx._emitLine('if(frame.topLevel) {');
      ctx._emitLine(`context.addExport("${name}", ${id});`);
      ctx._emitLine('}');
    }
  });
};
