import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileWith = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx._emitLine('frame = frame.push(true);');

  // Set inline assignments in the isolated frame
  if (node.assignments && (node.assignments as Node[]).length > 0) {
    (node.assignments as Node[]).forEach((pair) => {
      const name = pair.key as string;
      const valueId = ctx._tmpid();
      ctx._emitLine('let ' + valueId + ' = ');
      ctx._compileExpression(pair.value as Node, frame);
      ctx._emitLine(';');
      ctx._emitLine('frame.set("' + name + '", ' + valueId + ', true);');
    });
  }

  ctx._withScopedSyntax(() => {
    ctx.compile(node.body as Node, frame);
  });

  ctx._emitLine('frame = frame.pop();');
};
