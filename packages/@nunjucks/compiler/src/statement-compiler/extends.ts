import { ERROR_CODES } from '@nunjucks/error-catalog';
import type { ExtendsNode, IncludeNode } from '@nunjucks/nodes';
import { appendTarget, emitLineLocation } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileGetTemplate, getTemplateLocation } from './template-lookup.ts';

export const compileExtends = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<ExtendsNode>
): void => {
  const blockKey = compiler.nextCompilerId();

  const parentTemplateId = compileGetTemplate({
    compiler,
    node,
    frame,
    options: { eagerCompile: true, ignoreMissing: false, includeChain: compiler.getTemplateName() },
  });

  compiler.emitLine(`parentTemplate = ${parentTemplateId}`);

  compiler.emitLine('let __parentBlockNames = Object.keys(parentTemplate.blocks);');
  compiler.emitLine('context = context.setParentBlockNames(__parentBlockNames);');

  compiler.emitLine(`for(let ${blockKey} in parentTemplate.blocks) {`);
  compiler.emitLine(`context = context.addBlock(${blockKey}, parentTemplate.blocks[${blockKey}]);`);
  compiler.emitLine('}');

  compiler.emitLine('context.validateBlocks();');
};

export const compileInclude = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<IncludeNode>
): void => {
  const tmplVar = compiler.nextCompilerId();
  const resultVar = compiler.nextCompilerId();
  const location = getTemplateLocation(node);

  const emitIncludeBody = (): void => {
    emitLineLocation(compiler, location.lineno, location.colno);
    compiler.emit(`let ${tmplVar} = `);
    compiler.compileExpression(node.template, frame);
    compiler.emitLine(';');
    compiler.emitLine(
      `if(typeof ${tmplVar} !== 'string') { const err = new Error('template names must be a string'); err.code = ${JSON.stringify(ERROR_CODES.INVALID_INCLUDE)}; err.subject = ${tmplVar}; throw err; }`
    );
    const ignoreMissing = node.ignoreMissing ? 'true' : 'false';
    const includeChain = `{parentTmpl: ${compiler.getTemplateName()}, parentLineno: ${location.lineno + 1}, parentColno: ${location.colno + 1}}`;
    compiler.emit(
      `let ${tmplVar}_template = await env.getTemplate({ name: ${tmplVar}, eagerCompile: false, includeChain: ${includeChain}, ignoreMissing: ${ignoreMissing} });`
    );

    // WHY: env.getTemplate returns null (not a Template) for a missing source when
    // ignoreMissing is set — the render call below must be guarded or the generated
    // code dereferences null and surfaces a TypeError instead of skipping silently.
    if (node.ignoreMissing) {
      compiler.emitLine(`if (${tmplVar}_template !== null) {`);
    }
    if (node.only) {
      compiler.emit(`let ${resultVar} = await ${tmplVar}_template.render({}, frame);`);
    } else if (node.with) {
      compiler.emit('let __forkedCtx = context.fork();');
      compiler.emit('let __withData = ');
      compiler.compileExpression(node.with, frame);
      compiler.emitLine(';');
      compiler.emit('Object.assign(__forkedCtx.ctx, __withData);');
      compiler.emit(
        `let ${resultVar} = await ${tmplVar}_template.render(__forkedCtx.getVariables(), frame);`
      );
    } else {
      compiler.emit(
        `let ${resultVar} = await ${tmplVar}_template.render(context.getVariables(), frame);`
      );
    }
    compiler.emitLine(`${appendTarget(compiler)}${resultVar};`);
    if (node.ignoreMissing) {
      compiler.emitLine('}');
    }
  };

  if (compiler.streamErrorRecovery) {
    compiler.emitLine('try {');
    emitIncludeBody();
    compiler.emitStreamCatch(location.lineno, location.colno);
  } else {
    emitIncludeBody();
  }
};
