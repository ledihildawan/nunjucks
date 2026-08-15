import type { SwitchNode } from '@nunjucks/nodes';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

export const compileSwitch = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<SwitchNode>
): void => {
  compiler.emit('switch (');
  compiler.compile(node.expr, frame);
  compiler.emitLine(') {');
  forEach(node.cases ?? [], (c) => {
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
