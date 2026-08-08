import type { IfNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileIf = (compiler: Compiler, node: IfNode, frame: Frame): void => {
  compiler.emit('if(');
  compiler.compileExpression(node.cond, frame);
  compiler.emitLine(') {');

  compiler.withScopedSyntax(() => {
    compiler.emitLine('frame = frame.push(true);');
    compiler.compile(node.body, frame);
    compiler.emitLine('frame = frame.pop();');
  });

  const elseNode = node.alternate;
  if (elseNode) {
    compiler.emitLine('}\nelse {');

    compiler.withScopedSyntax(() => {
      compiler.emitLine('frame = frame.push(true);');
      compiler.compile(elseNode, frame);
      compiler.emitLine('frame = frame.pop();');
    });
  }

  compiler.emitLine('}');
};
