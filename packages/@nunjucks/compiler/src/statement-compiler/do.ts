import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileDo = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.emit('(');
  ctx.compileExpression(node.expr as Node, frame);
  ctx.emitLine(');');
};
