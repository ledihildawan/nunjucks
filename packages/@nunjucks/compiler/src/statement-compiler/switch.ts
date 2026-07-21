import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileSwitch = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx._emit('switch (');
  ctx.compile(node.expr as Node, frame);
  ctx._emitLine(') {');
  (node.cases as Node[]).forEach((c) => {
    ctx._emit('case ');
    ctx.compile(c.cond as Node, frame);
    ctx._emitLine(':');
    ctx._withScopedSyntax(() => {
      ctx._emitLine('frame = frame.push(true);');
      ctx.compile(c.body as Node, frame);
      ctx._emitLine('frame = frame.pop();');
    });
    if ((c.body as Node).children!.length) {
      ctx._emitLine('break;');
    }
  });
  if (node.default) {
    ctx._emitLine('default:');
    ctx._withScopedSyntax(() => {
      ctx._emitLine('frame = frame.push(true);');
      ctx.compile(node.default as Node, frame);
      ctx._emitLine('frame = frame.pop();');
    });
  }
  ctx._emitLine('}');
};
