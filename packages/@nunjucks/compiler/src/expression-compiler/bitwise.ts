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

/** Compiles `|` via the shared `compileBinaryBitwise` emitter. */
export const compileBitwiseOr = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => compileBinaryBitwise({ compiler, node, frame, operator: '|' });
/** Compiles `&` via the shared `compileBinaryBitwise` emitter. */
export const compileBitwiseAnd = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => compileBinaryBitwise({ compiler, node, frame, operator: '&' });
/** Compiles `^` via the shared `compileBinaryBitwise` emitter. */
export const compileBitwiseXor = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => compileBinaryBitwise({ compiler, node, frame, operator: '^' });
/** Compiles `<<` via the shared `compileBinaryBitwise` emitter. */
export const compileBitwiseLShift = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => compileBinaryBitwise({ compiler, node, frame, operator: '<<' });
/** Compiles `>>` via the shared `compileBinaryBitwise` emitter. */
export const compileBitwiseRShift = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => compileBinaryBitwise({ compiler, node, frame, operator: '>>' });

/** Compiles `~` as a location-guarded prefix on the operand. */
export const compileBitwiseNot = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<UnaryNode>
): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit('~');
  compiler.compile(node.target, frame);
  compiler.emit(')');
};
