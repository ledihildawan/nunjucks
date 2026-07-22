import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileIf = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.emit('if(');
  ctx.compileExpression(node.cond as Node, frame);
  ctx.emitLine(') {');

  ctx.withScopedSyntax(() => {
    ctx.emitLine('frame = frame.push(true);');
    ctx.compile(node.body as Node, frame);
    ctx.emitLine('frame = frame.pop();');
  });

  if (node.else_) {
    ctx.emitLine('}\nelse {');

    ctx.withScopedSyntax(() => {
      ctx.emitLine('frame = frame.push(true);');
      ctx.compile(node.else_ as Node, frame);
      ctx.emitLine('frame = frame.pop();');
    });
  }

  ctx.emitLine('}');
};
