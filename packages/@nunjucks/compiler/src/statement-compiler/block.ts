import type { BlockNode, SuperNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLineLocation } from '../compiler-helpers.ts';

export const compileBlock = (ctx: Compiler, node: BlockNode): void => {
  const id = ctx.tmpid();
  const nameNode = typeof node.name === 'string'
    ? { value: node.name, lineno: node.lineno, colno: node.colno }
    : node.name;
  const name = nameNode?.value ?? 'block';
  ctx.emitLine(`let ${id} = await (await context.getBlock("${name}", ${node.lineno}, ${node.colno}))(env, context, frame, runtime);`);
  ctx.emitLine(`${ctx.buffer} += ${id};`);
};

export const compileSuper = (ctx: Compiler, node: SuperNode, frame: Frame): void => {
  const name = node.blockName;
  const id = String(node.symbol?.value ?? 'super');

  emitLineLocation(ctx, node.lineno, node.colno);
  ctx.emitLine(`${id} = await context.getSuper(env, "${name}", b_${name}, frame, runtime, ${node.lineno}, ${node.colno});`);
  ctx.emitLine(`${id} = runtime.markSafe(${id});`);
  frame.set(id, id);
};
