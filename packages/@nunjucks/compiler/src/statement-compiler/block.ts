import type { BlockNode, SuperNode } from '@nunjucks/nodes';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { emitLineLocation, appendTarget } from '../codegen.ts';

export const compileBlock = (compiler: Compiler, node: BlockNode): void => {
  const id = compiler.tmpid();
  const nameNode = typeof node.name === 'string'
    ? { value: node.name, lineno: node.lineno, colno: node.colno }
    : node.name;
  const name = nameNode?.value ?? 'block';
  compiler.emitLine(`let ${id} = await (await context.getBlock("${name}", ${node.lineno}, ${node.colno}))(env, context, frame, runtime);`);
  compiler.emitLine(`${appendTarget(compiler)}${id};`);
};

export const compileSuper = (compiler: Compiler, { node, frame }: CompileNodeInput<SuperNode>): void => {
  const name = node.blockName;
  const id = String(node.symbol?.value ?? 'super');

  emitLineLocation(compiler, node.lineno, node.colno);
  compiler.emitLine(`${id} = await context.getSuper(env, "${name}", b_${name}, frame, runtime, ${node.lineno}, ${node.colno});`);
  compiler.emitLine(`${id} = runtime.markSafe(${id});`);
  compiler.emitLine(`frame = frame.set("${id}", ${id});`);
  frame.set(id, id);
};
