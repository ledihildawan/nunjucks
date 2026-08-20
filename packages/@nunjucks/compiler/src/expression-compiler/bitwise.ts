import type { BinaryNode, UnaryNode } from '@nunjucks/nodes';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { binOpEmitter } from './binary.ts';

/** Compiles `|` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileBitwiseOr = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' | ' });
/** Compiles `&` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileBitwiseAnd = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' & ' });
/** Compiles `^` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileBitwiseXor = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' ^ ' });
/** Compiles `<<` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileBitwiseLShift = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' << ' });
/** Compiles `>>` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileBitwiseRShift = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' >> ' });

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
