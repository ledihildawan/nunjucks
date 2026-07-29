import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';

export const compileSwitch = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.emit('switch (');
  ctx.compile(node.expr as Node, frame);
  ctx.emitLine(') {');
  forEach((node.cases as Node[]) ?? [], c => {
    ctx.emit('case ');
    ctx.compile(c.cond as Node, frame);
    ctx.emitLine(':');
    ctx.withScopedSyntax(() => {
      ctx.emitLine('frame = frame.push(true);');
      ctx.compile(c.body as Node, frame);
      ctx.emitLine('frame = frame.pop();');
    });
    if (((c.body as Node)?.children?.length ?? 0) > 0) {
      ctx.emitLine('break;');
    }
  });
  if (node.default) {
    ctx.emitLine('default:');
    ctx.withScopedSyntax(() => {
      ctx.emitLine('frame = frame.push(true);');
      ctx.compile(node.default as Node, frame);
      ctx.emitLine('frame = frame.pop();');
    });
  }
  ctx.emitLine('}');
};
