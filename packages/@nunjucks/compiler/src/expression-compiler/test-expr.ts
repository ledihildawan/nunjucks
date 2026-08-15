import type { TestCallNode, TestNode } from '@nunjucks/nodes';
import { forEach } from 'remeda';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

export const compileTest = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<TestNode>
): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  const targetTmp = compiler.nextCompilerId();
  compiler.emit(`((${targetTmp} = `);
  compiler.compile(node.target, frame);
  compiler.emit('), ');
  emitLocationGuard(compiler, lineno, colno);
  compiler.emit(`runtime.runTest(env, ${JSON.stringify(node.name)}, ${targetTmp}))`);
  compiler.emit(')');
};

export const compileTestCall = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<TestCallNode>
): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  const targetTmp = compiler.nextCompilerId();
  compiler.emit(`(${targetTmp} = `);
  compiler.compile(node.target, frame);
  compiler.emit(', ');

  const args: string[] = [];
  forEach(node.args, (argNode) => {
    if (!argNode) {
      return;
    }
    const argTmp = compiler.nextCompilerId();
    compiler.emit(`${argTmp} = `);
    compiler.compile(argNode, frame);
    compiler.emit(', ');
    args.push(argTmp);
  });

  emitLocationGuard(compiler, lineno, colno);
  const argsPart = args.length > 0 ? `, ${args.join(', ')}` : '';
  compiler.emit(`runtime.runTest(env, ${JSON.stringify(node.name)}, ${targetTmp}${argsPart}))`);
  compiler.emit(')');
};
