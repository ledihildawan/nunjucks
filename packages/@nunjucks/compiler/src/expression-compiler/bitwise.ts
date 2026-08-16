import type { BinaryNode, UnaryNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

interface BinaryBitwiseOptions {
  compiler: Compiler;
  node: BinaryNode;
  frame: Frame;
  operator: string;
}

const compileBinaryBitwise = ({ compiler, node, frame, operator }: BinaryBitwiseOptions): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.compile(node.left, frame);
  compiler.emit(` ${operator} `);
  compiler.compile(node.right, frame);
  compiler.emit(')');
};

export const compileBitwiseOr = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => compileBinaryBitwise({ compiler, node, frame, operator: '|' });
export const compileBitwiseAnd = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => compileBinaryBitwise({ compiler, node, frame, operator: '&' });
export const compileBitwiseXor = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => compileBinaryBitwise({ compiler, node, frame, operator: '^' });
export const compileBitwiseLShift = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => compileBinaryBitwise({ compiler, node, frame, operator: '<<' });
export const compileBitwiseRShift = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => compileBinaryBitwise({ compiler, node, frame, operator: '>>' });

export const compileBitwiseNot = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<UnaryNode>
): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit('~');
  compiler.compile(node.target, frame);
  compiler.emit(')');
};
