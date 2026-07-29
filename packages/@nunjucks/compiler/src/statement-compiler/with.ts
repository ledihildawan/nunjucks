import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';

export const compileWith = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.emitLine('frame = frame.push(true);');

  // Set inline assignments in the isolated frame
  if (node.assignments && (node.assignments as Node[]).length > 0) {
    forEach(node.assignments as Node[], pair => {
      const name = pair.key as string;
      const valueId = ctx.tmpid();
      ctx.emitLine(`let ${valueId} = `);
      ctx.compileExpression(pair.value as Node, frame);
      ctx.emitLine(';');
      ctx.emitLine(`frame.set("${name}", ${valueId}, true);`);
    });
  }

  ctx.withScopedSyntax(() => {
    ctx.compile(node.body as Node, frame);
  });

  ctx.emitLine('frame = frame.pop();');
};
