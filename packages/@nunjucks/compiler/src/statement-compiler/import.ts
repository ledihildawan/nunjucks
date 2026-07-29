import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { getTemplateLocation } from './extends.ts';

interface GetTemplateOptions {
  eagerCompile: boolean;
  ignoreMissing: boolean;
}

const compileGetTemplate = (ctx: Compiler, node: Node, frame: Frame, options: GetTemplateOptions): string => {
  const { eagerCompile, ignoreMissing } = options;
  const parentTemplateId = ctx.tmpid();
  const parentName = ctx.getTemplateName();
  const eagerCompileArg = eagerCompile ? 'true' : 'false';
  const ignoreMissingArg = ignoreMissing ? 'true' : 'false';
  const location = getTemplateLocation(node);
  ctx.emitLine(`lineno = ${location.lineno}; colno = ${location.colno};`);
  ctx.emit(`let ${parentTemplateId} = await env.getTemplate(`);
  ctx.compileExpression(node.template as Node, frame);
  ctx.emitLine(`, ${eagerCompileArg}, ${parentName}, ${ignoreMissingArg});`);
  return parentTemplateId;
};

export const compileImport = (ctx: Compiler, node: Node, frame: Frame): void => {
  const target = (node.target as Node).value as string;
  const id = compileGetTemplate(ctx, node, frame, { eagerCompile: false, ignoreMissing: false });

  const withContextArg = node.withContext ? 'context.getVariables(), frame' : '';
  ctx.emitLine(`let ${id}_exported = await ${id}.getExported(` +
    withContextArg +
    ');');

  if (frame.parent) {
    ctx.emitLine(`frame.set("${target}", ${id}_exported);`);
  } else {
    ctx.emitLine(`context.setVariable("${target}", ${id}_exported);`);
  }
};

export { compileGetTemplate };
