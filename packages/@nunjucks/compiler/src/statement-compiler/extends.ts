import type { ExtendsNode, IncludeNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLineLocation } from '../codegen.ts';
import { compileGetTemplate, getTemplateLocation } from './template-lookup.ts';

export const compileExtends = (compiler: Compiler, node: ExtendsNode, frame: Frame): void => {
  const k = compiler.tmpid();

  const parentTemplateId = compileGetTemplate(compiler, node, frame, { eagerCompile: true, ignoreMissing: false });

  compiler.emitLine(`parentTemplate = ${parentTemplateId}`);

  compiler.emitLine('let __parentBlockNames = Object.keys(parentTemplate.blocks);');
  compiler.emitLine('context.setParentBlockNames(__parentBlockNames);');

  compiler.emitLine(`for(let ${k} in parentTemplate.blocks) {`);
  compiler.emitLine(`context.addBlock(${k}, parentTemplate.blocks[${k}]);`);
  compiler.emitLine('}');

  compiler.emitLine('context.validateBlocks();');
};

export const compileInclude = (compiler: Compiler, node: IncludeNode, frame: Frame): void => {
  const tmplVar = compiler.tmpid();
  const resultVar = compiler.tmpid();
  const location = getTemplateLocation(node);

  emitLineLocation(compiler, location.lineno, location.colno);
  compiler.emit(`let ${tmplVar} = `);
  compiler.compileExpression(node.template, frame);
  compiler.emitLine(';');
  compiler.emitLine(`if(typeof ${tmplVar} !== 'string') { const err = new Error('template names must be a string'); err.code = 'INVALID_INCLUDE'; err.subject = ${tmplVar}; throw err; }`);
  compiler.emit(`let ${tmplVar}_template = await env.getTemplate(${tmplVar}, false, `);
  const ignoreMissing = node.ignoreMissing ? 'true' : 'false';
  const includeChain = `{parentTmpl: ${compiler.getTemplateName()}, parentLineno: ${location.lineno + 1}, parentColno: ${location.colno + 1}}`;
  compiler.emitLine(`${includeChain}, ${ignoreMissing});`);

  if (node.only) {
    compiler.emit(`let ${resultVar} = await ${tmplVar}_template.render({}, frame);`);
  } else if (node.with) {
    compiler.emit('let __forkedCtx = context.fork();');
    compiler.emit('let __withData = ');
    compiler.compileExpression(node.with, frame);
    compiler.emitLine(';');
    compiler.emit('Object.assign(__forkedCtx.ctx, __withData);');
    compiler.emit(`let ${resultVar} = await ${tmplVar}_template.render(__forkedCtx.getVariables(), frame);`);
  } else {
    compiler.emit(`let ${resultVar} = await ${tmplVar}_template.render(context.getVariables(), frame);`);
  }
  compiler.emitLine(`${compiler.buffer} += ${resultVar};`);
};
