import type { ScopeNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';

export const compileScope = (compiler: Compiler, node: ScopeNode, frame: Frame): void => {
  compiler.emitLine('frame = frame.push(true);');

  if (node.assignments?.length > 0) {
    forEach(node.assignments, pair => {
      const name = String(pair.key);
      const valueId = compiler.tmpid();
      compiler.emitLine(`let ${valueId} = `);
      compiler.compileExpression(pair.value, frame);
      compiler.emitLine(';');
      compiler.emitLine(`frame = frame.set("${name}", ${valueId}, true);`);
    });
  }

  compiler.withScopedSyntax(() => {
    compiler.compile(node.body, frame);
  });

  compiler.emitLine('frame = frame.pop();');
};
