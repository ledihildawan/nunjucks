import type { BlockNode, SuperNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLineLocation } from '../codegen.ts';

export const compileBlock = (compiler: Compiler, node: BlockNode): void => {
  const id = compiler.tmpid();
  const nameNode = typeof node.name === 'string'
    ? { value: node.name, lineno: node.lineno, colno: node.colno }
    : node.name;
  const name = nameNode?.value ?? 'block';
  compiler.emitLine(`let ${id} = await (await context.getBlock("${name}", ${node.lineno}, ${node.colno}))(env, context, frame, runtime);`);
  compiler.emitLine(`${compiler.buffer} += ${id};`);
};

export const compileSuper = (compiler: Compiler, node: SuperNode, frame: Frame): void => {
  const name = node.blockName;
  const id = String(node.symbol?.value ?? 'super');

  emitLineLocation(compiler, node.lineno, node.colno);
  compiler.emitLine(`${id} = await context.getSuper(env, "${name}", b_${name}, frame, runtime, ${node.lineno}, ${node.colno});`);
  compiler.emitLine(`${id} = runtime.markSafe(${id});`);
  frame.set(id, id);
};
