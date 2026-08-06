import type { ImportNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileGetTemplate } from './template-helpers.ts';

export const compileImport = (ctx: Compiler, node: ImportNode, frame: Frame): void => {
  const target = node.target;
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

export { compileGetTemplate } from './template-helpers.ts';
