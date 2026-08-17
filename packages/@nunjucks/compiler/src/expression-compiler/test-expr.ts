import type { TestCallNode, TestNode } from '@nunjucks/nodes';
import { forEach } from 'remeda';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

// WHY: test temporaries are declared with `let` inside an async IIFE — an undeclared
// assignment in emitted code creates an implicit global (compiled templates run via
// new Function in sloppy mode), letting interleaved renders corrupt each other's
// values. The async wrapper keeps targets containing `await` (e.g. filter results) legal.

/** Compiles a bare test to an awaited `runtime.runTest(env, name, target)` call. */
export const compileTest = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<TestNode>
): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  const targetTmp = compiler.nextCompilerId();
  compiler.emit(`(await (async () => { let ${targetTmp} = `);
  compiler.compile(node.target, frame);
  compiler.emit('; return ');
  emitLocationGuard(compiler, lineno, colno);
  compiler.emit(`runtime.runTest(env, ${JSON.stringify(node.name)}, ${targetTmp})); })())`);
};

/**
 * Compiles a parameterized test call, staging target and each argument into
 * `t_N` temporaries before the awaited `runtime.runTest` call.
 */
export const compileTestCall = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<TestCallNode>
): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  const targetTmp = compiler.nextCompilerId();
  compiler.emit(`(await (async () => { let ${targetTmp} = `);
  compiler.compile(node.target, frame);
  compiler.emit('; ');

  const args: string[] = [];
  forEach(node.args, (argNode) => {
    if (!argNode) {
      return;
    }
    const argTmp = compiler.nextCompilerId();
    compiler.emit(`let ${argTmp} = `);
    compiler.compile(argNode, frame);
    compiler.emit('; ');
    args.push(argTmp);
  });

  compiler.emit('return ');
  emitLocationGuard(compiler, lineno, colno);
  const argsPart = args.length > 0 ? `, ${args.join(', ')}` : '';
  compiler.emit(
    `runtime.runTest(env, ${JSON.stringify(node.name)}, ${targetTmp}${argsPart})); })())`
  );
};
