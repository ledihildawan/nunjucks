import type { SwitchNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';

export const compileSwitch = (compiler: Compiler, node: SwitchNode, frame: Frame): void => {
  compiler.emit('switch (');
  compiler.compile(node.expr, frame);
  compiler.emitLine(') {');
  forEach(node.cases ?? [], c => {
    compiler.emit('case ');
    compiler.compile(c.cond, frame);
    compiler.emitLine(':');
    compiler.withScopedSyntax(() => {
      compiler.emitLine('frame = frame.push(true);');
      compiler.compile(c.body, frame);
      compiler.emitLine('frame = frame.pop();');
    });
    if ((c.body.children?.length ?? 0) > 0) {
      compiler.emitLine('break;');
    }
  });
  const defaultNode = node.default;
  if (defaultNode) {
    compiler.emitLine('default:');
    compiler.withScopedSyntax(() => {
      compiler.emitLine('frame = frame.push(true);');
      compiler.compile(defaultNode, frame);
      compiler.emitLine('frame = frame.pop();');
    });
  }
  compiler.emitLine('}');
};
