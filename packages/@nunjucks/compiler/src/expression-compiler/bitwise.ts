import type { BinaryNode } from '@nunjucks/nodes';
import type { UnaryNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';

const compileBinaryBitwise = (ctx: Compiler, node: BinaryNode, frame: Frame, operator: string): void => {
  emitLocationGuard(ctx, node.lineno, node.colno);
  ctx.compile(node.left, frame);
  ctx.emit(` ${operator} `);
  ctx.compile(node.right, frame);
  ctx.emit(')');
};

export const compileBitwiseOr = (ctx: Compiler, node: BinaryNode, frame: Frame): void => compileBinaryBitwise(ctx, node, frame, '|');
export const compileBitwiseAnd = (ctx: Compiler, node: BinaryNode, frame: Frame): void => compileBinaryBitwise(ctx, node, frame, '&');
export const compileBitwiseXor = (ctx: Compiler, node: BinaryNode, frame: Frame): void => compileBinaryBitwise(ctx, node, frame, '^');
export const compileBitwiseLShift = (ctx: Compiler, node: BinaryNode, frame: Frame): void => compileBinaryBitwise(ctx, node, frame, '<<');
export const compileBitwiseRShift = (ctx: Compiler, node: BinaryNode, frame: Frame): void => compileBinaryBitwise(ctx, node, frame, '>>');

export const compileBitwiseNot = (ctx: Compiler, node: UnaryNode, frame: Frame): void => {
  emitLocationGuard(ctx, node.lineno, node.colno);
  ctx.emit('~');
  ctx.compile(node.target, frame);
  ctx.emit(')');
};
