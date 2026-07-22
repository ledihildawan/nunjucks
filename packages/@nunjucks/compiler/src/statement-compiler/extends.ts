import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const getTemplateLocation = (node: Node): { lineno: number; colno: number } => {
  const locationNode = (node.template as Node) || node;
  const isStringLiteral = locationNode.type === 'literal' && typeof locationNode.value === 'string';
  return {
    lineno: locationNode.lineno,
    colno: (locationNode.colno ?? 0) + (isStringLiteral ? 1 : 0)
  };
};

const compileGetTemplate = (ctx: Compiler, node: Node, frame: Frame, eagerCompile: boolean, ignoreMissing: boolean): string => {
  const parentTemplateId = ctx.tmpid();
  const parentName = ctx.getTemplateName();
  const eagerCompileArg = (eagerCompile) ? 'true' : 'false';
  const ignoreMissingArg = (ignoreMissing) ? 'true' : 'false';
  const location = getTemplateLocation(node);
  ctx.emitLine(`lineno = ${location.lineno}; colno = ${location.colno};`);
  ctx.emit(`let ${parentTemplateId} = await env.getTemplate(`);
  ctx.compileExpression(node.template as Node, frame);
  ctx.emitLine(`, ${eagerCompileArg}, ${parentName}, ${ignoreMissingArg});`);
  return parentTemplateId;
};

export const compileExtends = (ctx: Compiler, node: Node, frame: Frame): void => {
  const k = ctx.tmpid();

  const parentTemplateId = compileGetTemplate(ctx, node, frame, true, false);

  ctx.emitLine(`parentTemplate = ${parentTemplateId}`);

  ctx.emitLine(`let __parentBlockNames = Object.keys(parentTemplate.blocks);`);
  ctx.emitLine(`context.setParentBlockNames(__parentBlockNames);`);

  ctx.emitLine(`for(let ${k} in parentTemplate.blocks) {`);
  ctx.emitLine(`context.addBlock(${k}, parentTemplate.blocks[${k}]);`);
  ctx.emitLine('}');

  ctx.emitLine(`context.validateBlocks();`);
};

export const compileInclude = (ctx: Compiler, node: Node, frame: Frame): void => {
  const tmplVar = ctx.tmpid();
  const resultVar = ctx.tmpid();
  const location = getTemplateLocation(node);

  ctx.emitLine(`lineno = ${location.lineno}; colno = ${location.colno};`);
  ctx.emit(`let ${tmplVar} = `);
  ctx.compileExpression(node.template as Node, frame);
  ctx.emitLine(';');
  ctx.emitLine(`if(typeof ${tmplVar} !== 'string') { const err = new Error('template names must be a string'); err.code = 'INVALID_INCLUDE'; err.subject = ${tmplVar}; throw err; }`);
  ctx.emit(`let ${tmplVar}_template = await env.getTemplate(${tmplVar}, false, `);
  const ignoreMissing = node.ignoreMissing ? 'true' : 'false';
  const includeChain = `{parentTmpl: ${ctx.getTemplateName()}, parentLineno: ${location.lineno + 1}, parentColno: ${location.colno + 1}}`;
  ctx.emitLine(`${includeChain}, ${ignoreMissing});`);

  if (node.only) {
    ctx.emit(`let ${resultVar} = await ${tmplVar}_template.render({}, frame);`);
  } else if (node.with) {
    ctx.emit(`let __forkedCtx = context.fork();`);
    ctx.emit(`let __withData = `);
    ctx.compileExpression(node.with as Node, frame);
    ctx.emitLine(';');
    ctx.emit(`Object.assign(__forkedCtx.ctx, __withData);`);
    ctx.emit(`let ${resultVar} = await ${tmplVar}_template.render(__forkedCtx.getVariables(), frame);`);
  } else {
    ctx.emit(`let ${resultVar} = await ${tmplVar}_template.render(context.getVariables(), frame);`);
  }
  ctx.emitLine(`${ctx.buffer} += ${resultVar};`);
};
