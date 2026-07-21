import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

export const compileBlock = (ctx: Compiler, node: Node): void => {
  const id = ctx._tmpid();
  const nameNode = node.name as Node;
  const lineno = nameNode?.lineno ?? node.lineno ?? 0;
  const colno = nameNode?.colno ?? node.colno ?? 0;
  ctx._emitLine(`let ${id} = await (await context.getBlock("${nameNode.value}", ${lineno}, ${colno}))(env, context, frame, runtime);`);
  ctx._emitLine(`${ctx.buffer} += ${id};`);
};

export const compileSuper = (ctx: Compiler, node: Node, frame: Frame): void => {
  const blockName = node.blockName as Node;
  const sym = node.symbol as Node;
  const name = blockName.value as string;
  const id = sym.value as string;

  ctx._emitLine(`lineno = ${node.lineno}; colno = ${node.colno};`);
  ctx._emitLine(`${id} = await context.getSuper(env, "${name}", b_${name}, frame, runtime, ${node.lineno}, ${node.colno});`);
  ctx._emitLine(`${id} = runtime.markSafe(${id});`);
  frame.set(id, id);
};
