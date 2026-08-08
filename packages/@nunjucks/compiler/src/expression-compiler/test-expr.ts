import { forEach } from 'remeda';
import type { TestNode, TestCallNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../codegen.ts';

export const compileTest = (compiler: Compiler, node: TestNode, frame: Frame): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  const targetTmp = compiler.tmpid();
  compiler.emit(`((${targetTmp} = `);
  compiler.compile(node.target, frame);
  compiler.emit('), ');
  emitLocationGuard(compiler, lineno, colno);
  compiler.emit(`runtime.runTest(env, ${JSON.stringify(node.name)}, ${targetTmp}))`);
  compiler.emit(')');
};

export const compileTestCall = (compiler: Compiler, node: TestCallNode, frame: Frame): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  const targetTmp = compiler.tmpid();
  compiler.emit(`(${targetTmp} = `);
  compiler.compile(node.target, frame);
  compiler.emit(', ');

  const args: string[] = [];
  forEach(node.args, (argNode) => {
    if (!argNode) { return; }
    const argTmp = compiler.tmpid();
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
