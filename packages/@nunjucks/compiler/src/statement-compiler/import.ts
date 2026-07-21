import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { getTemplateLocation } from './extends.ts';

const compileGetTemplate = (ctx: Compiler, node: Node, frame: Frame, eagerCompile: boolean, ignoreMissing: boolean): string => {
  const parentTemplateId = ctx._tmpid();
  const parentName = ctx._templateName();
  const eagerCompileArg = (eagerCompile) ? 'true' : 'false';
  const ignoreMissingArg = (ignoreMissing) ? 'true' : 'false';
  const location = getTemplateLocation(node);
  ctx._emitLine(`lineno = ${location.lineno}; colno = ${location.colno};`);
  ctx._emit(`let ${parentTemplateId} = await env.getTemplate(`);
  ctx._compileExpression(node.template as Node, frame);
  ctx._emitLine(`, ${eagerCompileArg}, ${parentName}, ${ignoreMissingArg});`);
  return parentTemplateId;
};

export const compileImport = (ctx: Compiler, node: Node, frame: Frame): void => {
  const target = (node.target as Node).value as string;
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
