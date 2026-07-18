const compileGetTemplate = (ctx, node, frame, eagerCompile, ignoreMissing) => {
  const parentTemplateId = ctx._tmpid();
  const parentName = ctx._templateName();
  const eagerCompileArg = (eagerCompile) ? 'true' : 'false';
  const ignoreMissingArg = (ignoreMissing) ? 'true' : 'false';
  const loc = (node?.template && typeof node.template === 'object' && (node.template.lineno !== undefined || node.template.colno !== undefined))
    ? (node.template.type === 'literal' && typeof node.template.colno === 'number'
        ? { lineno: node.template.lineno, colno: node.template.colno + 1 }
        : { lineno: node.template.lineno, colno: node.template.colno })
    : { lineno: node.lineno, colno: node.colno };
  ctx._emitLine(`lineno = ${loc.lineno != null ? loc.lineno : 0}; colno = ${loc.colno != null ? loc.colno : 0};`);
  ctx._emit(`let ${parentTemplateId} = await env.getTemplate(`);
  ctx._compileExpression(node.template, frame);
  ctx._emitLine(`, ${eagerCompileArg}, ${parentName}, ${ignoreMissingArg});`);
  return parentTemplateId;
};

export const compileImport = (ctx, node, frame) => {
  const target = node.target.value;
  const id = compileGetTemplate(ctx, node, frame, false, false);

  ctx._emitLine(`let ${id}_exported = await ${id}.getExported(` +
    (node.withContext ? 'context.getVariables(), frame' : '') +
    ');');

  if (frame.parent) {
    ctx._emitLine(`frame.set("${target}", ${id}_exported);`);
  } else {
    ctx._emitLine(`context.setVariable("${target}", ${id}_exported);`);
  }
};

export { compileGetTemplate };
