import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

const compileBinaryBitwise = (ctx: Compiler, node: Node, frame: Frame, operator: string): void => {
  ctx.emit(`(lineno = ${node.lineno ?? 0}, colno = ${node.colno ?? 0}, `);
  ctx.compile(node.left as Node, frame);
  ctx.emit(` ${operator} `);
  ctx.compile(node.right as Node, frame);
  ctx.emit(')');
};

export const compileBitwiseOr = (ctx: Compiler, node: Node, frame: Frame): void => compileBinaryBitwise(ctx, node, frame, '|');
export const compileBitwiseAnd = (ctx: Compiler, node: Node, frame: Frame): void => compileBinaryBitwise(ctx, node, frame, '&');
export const compileBitwiseXor = (ctx: Compiler, node: Node, frame: Frame): void => compileBinaryBitwise(ctx, node, frame, '^');
export const compileBitwiseLShift = (ctx: Compiler, node: Node, frame: Frame): void => compileBinaryBitwise(ctx, node, frame, '<<');
export const compileBitwiseRShift = (ctx: Compiler, node: Node, frame: Frame): void => compileBinaryBitwise(ctx, node, frame, '>>');

export const compileBitwiseNot = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.emit(`(lineno = ${node.lineno ?? 0}, colno = ${node.colno ?? 0}, ~`);
  ctx.compile(node.target as Node, frame);
  ctx.emit(')');
};
