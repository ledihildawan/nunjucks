import type { Node } from '@nunjucks/nodes';
import type { Compiler } from '../../index.ts';
import type { CompileNodeInput } from '../../node-dispatch.ts';

export const compileTemplateData = (
  compiler: Compiler,
  { node, frame: _frame }: CompileNodeInput<Node>
): void => {
  compiler.emit(`${compiler.buffer} += `);
  compiler.emit(JSON.stringify(node.value));
  compiler.emit(';');
};
