import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileIf = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx._emit('if(');
  ctx._compileExpression(node.cond as Node, frame);
  ctx._emitLine(') {');

  ctx._withScopedSyntax(() => {
    ctx._emitLine('frame = frame.push(true);');
    ctx.compile(node.body as Node, frame);
    ctx._emitLine('frame = frame.pop();');
  });

  if (node.else_) {
    ctx._emitLine('}\nelse {');

    ctx._withScopedSyntax(() => {
      ctx._emitLine('frame = frame.push(true);');
      ctx.compile(node.else_ as Node, frame);
      ctx._emitLine('frame = frame.pop();');
    });
  }

  ctx._emitLine('}');
};
