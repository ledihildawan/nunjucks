import type { TestNode, TestCallNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';

export const compileTest = (ctx: Compiler, node: TestNode, frame: Frame): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  const targetTmp = ctx.tmpid();
  ctx.emit(`((${targetTmp} = `);
  ctx.compile(node.target, frame);
  ctx.emit('), ');
  emitLocationGuard(ctx, lineno, colno);
  ctx.emit(`runtime.runTest(env, ${JSON.stringify(node.name)}, ${targetTmp}))`);
  ctx.emit(')');
};

export const compileTestCall = (ctx: Compiler, node: TestCallNode, frame: Frame): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  const targetTmp = ctx.tmpid();
  ctx.emit(`(${targetTmp} = `);
  ctx.compile(node.target, frame);
  ctx.emit(', ');

  const args: string[] = [];
  for (const argNode of node.args) {
    if (!argNode) { continue; }
    const argTmp = ctx.tmpid();
    ctx.emit(`${argTmp} = `);
    ctx.compile(argNode, frame);
    ctx.emit(', ');
    args.push(argTmp);
  }

  emitLocationGuard(ctx, lineno, colno);
  const argsPart = args.length > 0 ? `, ${args.join(', ')}` : '';
  ctx.emit(`runtime.runTest(env, ${JSON.stringify(node.name)}, ${targetTmp}${argsPart}))`);
  ctx.emit(')');
};
