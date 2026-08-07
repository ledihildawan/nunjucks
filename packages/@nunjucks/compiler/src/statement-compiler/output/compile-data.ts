import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../../index.ts';

export const compileTemplateData = (
  compiler: Compiler,
  node: Node,
  _frame: Frame
): void => {
  compiler.emit(`${compiler.buffer} += `);
  compiler.emit(JSON.stringify(node.value));
  compiler.emit(';');
};
