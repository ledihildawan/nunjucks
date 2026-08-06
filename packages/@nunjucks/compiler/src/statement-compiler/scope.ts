import type { ScopeNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';

export const compileScope = (ctx: Compiler, node: ScopeNode, frame: Frame): void => {
  ctx.emitLine('frame = frame.push(true);');

  if (node.assignments?.length > 0) {
    forEach(node.assignments, pair => {
      const name = String(pair.key);
      const valueId = ctx.tmpid();
      ctx.emitLine(`let ${valueId} = `);
      ctx.compileExpression(pair.value, frame);
      ctx.emitLine(';');
      ctx.emitLine(`frame.set("${name}", ${valueId}, true);`);
    });
  }

  ctx.withScopedSyntax(() => {
    ctx.compile(node.body, frame);
  });

  ctx.emitLine('frame = frame.pop();');
};
