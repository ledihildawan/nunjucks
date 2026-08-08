import type { ImportNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileGetTemplate } from './template-lookup.ts';

export const compileImport = (compiler: Compiler, node: ImportNode, frame: Frame): void => {
  const target = node.target;
  const id = compileGetTemplate(compiler, node, frame, { eagerCompile: false, ignoreMissing: false });

  const withContextArg = node.withContext ? 'context.getVariables(), frame' : '';
  compiler.emitLine(`let ${id}_exported = await ${id}.getExported(` +
    withContextArg +
    ');');

  if (frame.parent) {
    compiler.emitLine(`frame = frame.set("${target}", ${id}_exported);`);
  } else {
    compiler.emitLine(`context = context.setVariable("${target}", ${id}_exported);`);
  }
};

export { compileGetTemplate } from './template-lookup.ts';
