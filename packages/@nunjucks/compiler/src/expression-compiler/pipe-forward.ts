import type { CallNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compilePipeForward = (ctx: Compiler, node: CallNode, frame: Frame): void => {
  const name = node.name;
  ctx.assertType(name, 'symbol');
  const filterName = String(name.value);
  const filterLocation = `${node.lineno}, ${node.colno ?? 0}`;

  const args = node.args;

  ctx.emit(`await runtime.awaitValue(env.getFilter("${filterName}", ${filterLocation}).call(context, `);

  for (let i = 0; i < args.length; i++) {
    if (i > 0) {
      ctx.emit(', ');
    }
    const arg = args[i];
    if (arg) {
      ctx.emit('await runtime.awaitValue(');
      ctx.compile(arg, frame);
      ctx.emit(')');
    }
  }

  ctx.emit('))');
};
