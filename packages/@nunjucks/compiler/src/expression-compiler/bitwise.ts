import type { BinaryNode } from '@nunjucks/nodes';
import type { UnaryNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../codegen.ts';

const compileBinaryBitwise = (compiler: Compiler, node: BinaryNode, frame: Frame, operator: string): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.compile(node.left, frame);
  compiler.emit(` ${operator} `);
  compiler.compile(node.right, frame);
  compiler.emit(')');
};

export const compileBitwiseOr = (compiler: Compiler, node: BinaryNode, frame: Frame): void => compileBinaryBitwise(compiler, node, frame, '|');
export const compileBitwiseAnd = (compiler: Compiler, node: BinaryNode, frame: Frame): void => compileBinaryBitwise(compiler, node, frame, '&');
export const compileBitwiseXor = (compiler: Compiler, node: BinaryNode, frame: Frame): void => compileBinaryBitwise(compiler, node, frame, '^');
export const compileBitwiseLShift = (compiler: Compiler, node: BinaryNode, frame: Frame): void => compileBinaryBitwise(compiler, node, frame, '<<');
export const compileBitwiseRShift = (compiler: Compiler, node: BinaryNode, frame: Frame): void => compileBinaryBitwise(compiler, node, frame, '>>');

export const compileBitwiseNot = (compiler: Compiler, node: UnaryNode, frame: Frame): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit('~');
  compiler.compile(node.target, frame);
  compiler.emit(')');
};
