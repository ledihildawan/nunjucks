export const getTemplateLocation = (node) => {
  const locationNode = node.template || node;
  const isStringLiteral = locationNode.type === 'literal' && typeof locationNode.value === 'string';
  return {
    lineno: locationNode.lineno,
    colno: (locationNode.colno ?? 0) + (isStringLiteral ? 1 : 0)
  };
};

const compileGetTemplate = (ctx, node, frame, eagerCompile, ignoreMissing) => {
  const parentTemplateId = ctx._tmpid();
  const parentName = ctx._templateName();
  const eagerCompileArg = (eagerCompile) ? 'true' : 'false';
  const ignoreMissingArg = (ignoreMissing) ? 'true' : 'false';
  const location = getTemplateLocation(node);
  ctx._emitLine(`lineno = ${location.lineno}; colno = ${location.colno};`);
  ctx._emit(`let ${parentTemplateId} = await env.getTemplate(`);
  ctx._compileExpression(node.template, frame);
  ctx._emitLine(`, ${eagerCompileArg}, ${parentName}, ${ignoreMissingArg});`);
  return parentTemplateId;
};

export const compileExtends = (ctx, node, frame) => {
  const k = ctx._tmpid();

  const parentTemplateId = compileGetTemplate(ctx, node, frame, true, false);

  ctx._emitLine(`parentTemplate = ${parentTemplateId}`);

  ctx._emitLine(`let __parentBlockNames = Object.keys(parentTemplate.blocks);`);
  ctx._emitLine(`context.setParentBlockNames(__parentBlockNames);`);

  ctx._emitLine(`for(let ${k} in parentTemplate.blocks) {`);
  ctx._emitLine(`context.addBlock(${k}, parentTemplate.blocks[${k}]);`);
  ctx._emitLine('}');

  ctx._emitLine(`context.validateBlocks();`);
};

export const compileInclude = (ctx, node, frame) => {
  const tmplVar = ctx._tmpid();
  const resultVar = ctx._tmpid();
  const location = getTemplateLocation(node);

  ctx._emitLine(`lineno = ${location.lineno}; colno = ${location.colno};`);
  ctx._emit(`let ${tmplVar} = `);
  ctx._compileExpression(node.template, frame);
  ctx._emitLine(';');
  ctx._emitLine(`if(typeof ${tmplVar} !== 'string') { const err = new Error('template names must be a string'); err.code = 'INVALID_INCLUDE'; err.subject = ${tmplVar}; throw err; }`);
  ctx._emit(`let ${tmplVar}_template = await env.getTemplate(${tmplVar}, false, `);
  const ignoreMissing = node.ignoreMissing ? 'true' : 'false';
  const includeChain = `{parentTmpl: ${ctx._templateName()}, parentLineno: ${location.lineno + 1}, parentColno: ${location.colno + 1}}`;
  ctx._emitLine(`${includeChain}, ${ignoreMissing});`);

  if (node.only) {
    ctx._emit(`let ${resultVar} = await ${tmplVar}_template.render({}, frame);`);
  } else if (node.with) {
    ctx._emit(`let __forkedCtx = context.fork();`);
    ctx._emit(`let __withData = `);
    ctx._compileExpression(node.with, frame);
    ctx._emitLine(';');
    ctx._emit(`Object.assign(__forkedCtx.ctx, __withData);`);
    ctx._emit(`let ${resultVar} = await ${tmplVar}_template.render(__forkedCtx.getVariables(), frame);`);
  } else {
    ctx._emit(`let ${resultVar} = await ${tmplVar}_template.render(context.getVariables(), frame);`);
  }
  ctx._emitLine(`${ctx.buffer} += ${resultVar};`);
};
