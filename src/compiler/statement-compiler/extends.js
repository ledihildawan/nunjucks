const compileGetTemplate = (ctx, node, frame, eagerCompile, ignoreMissing) => {
  const parentTemplateId = ctx._tmpid();
  const parentName = ctx._templateName();
  const eagerCompileArg = (eagerCompile) ? 'true' : 'false';
  const ignoreMissingArg = (ignoreMissing) ? 'true' : 'false';
  ctx._emitLine(`lineno = ${node.lineno}; colno = ${node.colno != null ? node.colno : 0};`);
  ctx._emit(`var ${parentTemplateId} = await env.getTemplate(`);
  ctx._compileExpression(node.template, frame);
  ctx._emitLine(`, ${eagerCompileArg}, ${parentName}, ${ignoreMissingArg});`);
  return parentTemplateId;
};

export const compileExtends = (ctx, node, frame) => {
  const k = ctx._tmpid();

  const parentTemplateId = compileGetTemplate(ctx, node, frame, true, false);

  ctx._emitLine(`parentTemplate = ${parentTemplateId}`);

  ctx._emitLine(`var __parentBlockNames = Object.keys(parentTemplate.blocks);`);
  ctx._emitLine(`context.setParentBlockNames(__parentBlockNames);`);

  ctx._emitLine(`for(var ${k} in parentTemplate.blocks) {`);
  ctx._emitLine(`context.addBlock(${k}, parentTemplate.blocks[${k}]);`);
  ctx._emitLine('}');

  ctx._emitLine(`context.validateBlocks();`);
};

export const compileInclude = (ctx, node, frame) => {
  const tmplVar = ctx._tmpid();
  const resultVar = ctx._tmpid();

  ctx._emitLine(`lineno = ${node.lineno}; colno = ${node.colno != null ? node.colno : 0};`);
  ctx._emit(`var ${tmplVar} = await env.getTemplate(`);
  ctx._compileExpression(node.template, frame);
  const ignoreMissing = node.ignoreMissing ? 'true' : 'false';
  const includeChain = `{parentTmpl: ${ctx._templateName()}, parentLineno: ${node.lineno + 1}, parentColno: ${node.colno !== undefined ? node.colno + 1 : 0}}`;
  ctx._emitLine(`, false, ${includeChain}, ${ignoreMissing});`);

  if (node.only) {
    ctx._emit(`var ${resultVar} = await ${tmplVar}.render({}, frame);`);
  } else if (node.with) {
    ctx._emit(`var __forkedCtx = context.fork();`);
    ctx._emit(`var __withData = `);
    ctx._compileExpression(node.with, frame);
    ctx._emitLine(';');
    ctx._emit(`Object.assign(__forkedCtx.ctx, __withData);`);
    ctx._emit(`var ${resultVar} = await ${tmplVar}.render(__forkedCtx.getVariables(), frame);`);
  } else {
    ctx._emit(`var ${resultVar} = await ${tmplVar}.render(context.getVariables(), frame);`);
  }
  ctx._emitLine(`${ctx.buffer} += ${resultVar};`);
};
