import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../../index.ts';

export const compileTemplateData = (
  ctx: Compiler,
  node: Node,
  _frame: Frame
): void => {
  ctx.emit(`${ctx.buffer} += `);
  ctx.emit(JSON.stringify(node.value));
  ctx.emit(';');
};
