import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compilePipeForward = (ctx: Compiler, node: Node, frame: Frame): void => {
  const name = node.name as Node;
  ctx.assertType(name, 'symbol');
  const filterName = String(name.value);
  const filterLocation = `${node.lineno}, ${node.colno ?? 0}`;

  const args = (node.args as Node[]) || [];

  ctx.emit(`await runtime.awaitValue(env.getFilter("${filterName}", ${filterLocation}).call(context, `);

  args.forEach((arg, i) => {
    if (i > 0) {
      ctx.emit(', ');
    }
    ctx.compile(arg, frame);
  });

  ctx.emit('))');
};
