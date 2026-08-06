import type { IfNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileIf = (ctx: Compiler, node: IfNode, frame: Frame): void => {
  ctx.emit('if(');
  ctx.compileExpression(node.cond, frame);
  ctx.emitLine(') {');

  ctx.withScopedSyntax(() => {
    ctx.emitLine('frame = frame.push(true);');
    ctx.compile(node.body, frame);
    ctx.emitLine('frame = frame.pop();');
  });

  const elseNode = node.else_;
  if (elseNode) {
    ctx.emitLine('}\nelse {');

    ctx.withScopedSyntax(() => {
      ctx.emitLine('frame = frame.push(true);');
      ctx.compile(elseNode, frame);
      ctx.emitLine('frame = frame.pop();');
    });
  }

  ctx.emitLine('}');
};
