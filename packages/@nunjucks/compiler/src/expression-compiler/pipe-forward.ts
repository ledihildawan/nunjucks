import type { CallNode } from '@nunjucks/nodes';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

export const compilePipeForward = (compiler: Compiler, { node, frame }: CompileNodeInput<CallNode>): void => {
  const name = node.name;
  compiler.assertType(name, 'symbol');
  const filterName = String(name.value);
  const filterLocation = `${node.lineno}, ${node.colno ?? 0}`;

  const args = node.args;

  compiler.emit(`await runtime.runFilter(env, ${JSON.stringify(filterName)}, ${filterLocation}, context, `);

  args.forEach((argument, i) => {
    if (i > 0) {
      compiler.emit(', ');
    }
    if (argument) {
      compiler.emit('await runtime.awaitValue(');
      compiler.compile(argument, frame);
      compiler.emit(')');
    }
  });

  compiler.emit(')');
};
