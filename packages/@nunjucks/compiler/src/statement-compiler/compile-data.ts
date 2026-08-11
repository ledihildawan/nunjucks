import type { Node } from '@nunjucks/nodes';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { appendTarget } from '../codegen.ts';

export const compileTemplateData = (
  compiler: Compiler,
  { node, frame: _frame }: CompileNodeInput<Node>
): void => {
  compiler.emit(appendTarget(compiler));
  compiler.emit(JSON.stringify(node.value));
  compiler.emit(';');
};
