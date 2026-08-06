import type { SwitchNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';

export const compileSwitch = (ctx: Compiler, node: SwitchNode, frame: Frame): void => {
  ctx.emit('switch (');
  ctx.compile(node.expr, frame);
  ctx.emitLine(') {');
  forEach(node.cases ?? [], c => {
    ctx.emit('case ');
    ctx.compile(c.cond, frame);
    ctx.emitLine(':');
    ctx.withScopedSyntax(() => {
      ctx.emitLine('frame = frame.push(true);');
      ctx.compile(c.body, frame);
      ctx.emitLine('frame = frame.pop();');
    });
    if ((c.body.children?.length ?? 0) > 0) {
      ctx.emitLine('break;');
    }
  });
  const defaultNode = node.default;
  if (defaultNode) {
    ctx.emitLine('default:');
    ctx.withScopedSyntax(() => {
      ctx.emitLine('frame = frame.push(true);');
      ctx.compile(defaultNode, frame);
      ctx.emitLine('frame = frame.pop();');
    });
  }
  ctx.emitLine('}');
};
