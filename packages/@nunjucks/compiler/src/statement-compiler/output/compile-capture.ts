import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../../index.ts';

export const compileCapture = (
  ctx: Compiler,
  node: Node,
  frame: Frame
): void => {
  const { buffer } = ctx;
  ctx.buffer = 'output';
  ctx.emitLine('(async () => {');
  ctx.emitLine('let output = "";');
  ctx.withScopedSyntax(() => {
    ctx.compile(node.body as Node, frame);
  });
  ctx.emitLine('return output;');
  ctx.emitLine('})()');
  ctx.buffer = buffer;
};
