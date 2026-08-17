import type { CallNode } from '@nunjucks/nodes';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

/**
 * Compiles `|> filter(args)` to an awaited async IIFE calling
 * `runtime.runFilter`, unwrapping its `r.ok`/`r.error` Result and awaiting
 * each argument so promise-valued operands resolve before the call.
 */
export const compilePipeForward = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<CallNode>
): void => {
  const name = node.name;
  compiler.assertType(name, 'symbol');
  const filterName = String(name.value);

  const args = node.args;

  compiler.emit(
    `await (async () => { const r = await runtime.runFilter({ env, name: ${JSON.stringify(filterName)}, lineno: ${node.lineno ?? 0}, colno: ${node.colno ?? 0}, context, args: [`
  );

  for (let i = 0; i < args.length; i++) {
    const argument = args[i];
    if (i > 0) {
      compiler.emit(', ');
    }
    if (argument) {
      compiler.emit('await runtime.awaitValue(');
      compiler.compile(argument, frame);
      compiler.emit(')');
    }
  }

  compiler.emit('] }); if (!r.ok) { throw r.error; } return r.value; })()');
};
