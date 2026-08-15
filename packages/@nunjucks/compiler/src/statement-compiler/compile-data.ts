import type { Node } from '@nunjucks/nodes';
import { appendTarget } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

export const compileTemplateData = (compiler: Compiler, { node }: CompileNodeInput<Node>): void => {
  compiler.emit(appendTarget(compiler));
  compiler.emit(JSON.stringify(node.value));
  compiler.emit(';');
};
