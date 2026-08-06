import type { Node, BinaryNode, BinaryOpNode, NodeLocation, RangeNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';

const binOpEmitter = (ctx: Compiler, node: NodeLocation & { left: Node; right: Node }, frame: Frame, str: string): void => {
  emitLocationGuard(ctx, node.lineno, node.colno);
  ctx.compile(node.left, frame);
  ctx.emit(str);
  ctx.compile(node.right, frame);
  ctx.emit(')');
};

export const compileOr = (ctx: Compiler, node: BinaryNode, frame: Frame): void => binOpEmitter(ctx, node, frame, ' || ');

export const compileAnd = (ctx: Compiler, node: BinaryNode, frame: Frame): void => binOpEmitter(ctx, node, frame, ' && ');

export const compileAdd = (ctx: Compiler, node: BinaryOpNode, frame: Frame): void => binOpEmitter(ctx, node, frame, ' + ');

export const compileConcat = (ctx: Compiler, node: BinaryNode, frame: Frame): void => binOpEmitter(ctx, node, frame, ' + "" + ');

export const compileRange = (ctx: Compiler, node: RangeNode, frame: Frame): void => {
  ctx.emit('(() => { let s = ');
  ctx.compile(node.left, frame);
  ctx.emit('; let e = ');
  ctx.compile(node.right, frame);
  ctx.emit('; let r = []; for (let i = s; i <= e; i++) { r.push(i); } return r; })()');
};

export const compileSub = (ctx: Compiler, node: BinaryOpNode, frame: Frame): void => binOpEmitter(ctx, node, frame, ' - ');

export const compileMul = (ctx: Compiler, node: BinaryOpNode, frame: Frame): void => binOpEmitter(ctx, node, frame, ' * ');

export const compileDiv = (ctx: Compiler, node: BinaryOpNode, frame: Frame): void => binOpEmitter(ctx, node, frame, ' / ');

export const compileMod = (ctx: Compiler, node: BinaryOpNode, frame: Frame): void => binOpEmitter(ctx, node, frame, ' % ');

export const compileNullishCoalesce = (ctx: Compiler, node: BinaryNode, frame: Frame): void => {
  emitLocationGuard(ctx, node.lineno, node.colno);
  ctx.compile(node.left, frame);
  ctx.emit(' ?? ');
  ctx.compile(node.right, frame);
  ctx.emit(')');
};

export const compileIn = (ctx: Compiler, node: BinaryNode, frame: Frame): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  emitLocationGuard(ctx, lineno, colno);
  ctx.emit('runtime.inOperator(');
  ctx.compile(node.left, frame);
  ctx.emit(',');
  ctx.compile(node.right, frame);
  ctx.emit(`, ${lineno}, ${colno}))`);
};

export const compileFloorDiv = (ctx: Compiler, node: BinaryOpNode, frame: Frame): void => {
  emitLocationGuard(ctx, node.lineno, node.colno);
  ctx.emit('Math.floor(');
  ctx.compile(node.left, frame);
  ctx.emit(' / ');
  ctx.compile(node.right, frame);
  ctx.emit('))');
};

export const compilePow = (ctx: Compiler, node: BinaryOpNode, frame: Frame): void => {
  emitLocationGuard(ctx, node.lineno, node.colno);
  ctx.emit('Math.pow(');
  ctx.compile(node.left, frame);
  ctx.emit(', ');
  ctx.compile(node.right, frame);
  ctx.emit('))');
};
