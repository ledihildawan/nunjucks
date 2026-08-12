import type { BlockNode, SuperNode } from '@nunjucks/nodes';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { emitLineLocation } from '../codegen.ts';

export const compileBlock = (compiler: Compiler, node: BlockNode): void => {
  const nameNode = typeof node.name === 'string'
    ? { value: node.name, lineno: node.lineno, colno: node.colno }
    : node.name;
  const name = nameNode?.value ?? 'block';
  // WHY: Option C — block functions are async generators. In a generator context (buffer === null) delegate with yield* so the block's chunks stream through; in a string-accumulating context (capture/slot buffer) drain the block into a string via runtime.collectString.
  const blockInvoke = `(await context.getBlock("${name}", ${node.lineno}, ${node.colno}))(env, context, frame, runtime)`;
  if (compiler.buffer === null) {
    compiler.emitLine(`yield* ${blockInvoke};`);
  } else {
    compiler.emitLine(`${compiler.buffer} += await runtime.collectString(${blockInvoke});`);
  }
};

export const compileSuper = (compiler: Compiler, { node, frame }: CompileNodeInput<SuperNode>): void => {
  const name = node.blockName;
  const id = String(node.symbol?.value ?? 'super');

  emitLineLocation(compiler, node.lineno, node.colno);
  compiler.emitLine(`${id} = await context.getSuper({ envObj: env, name: "${name}", block: b_${name}, frame, runtime, lineno: ${node.lineno}, colno: ${node.colno} });`);
  compiler.emitLine(`${id} = runtime.markSafe(${id});`);
  compiler.emitLine(`frame = frame.set({ name: "${id}", value: ${id} });`);
  frame.set({ name: id, value: id });
};
