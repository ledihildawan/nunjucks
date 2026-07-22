import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

const emitLocation = (ctx: Compiler, node: Node): void => {
  ctx.emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', ');
};

const binOpEmitter = (ctx: Compiler, node: Node, frame: Frame, str: string): void => {
  emitLocation(ctx, node);
  ctx.compile(node.left as Node, frame);
  ctx.emit(str);
  ctx.compile(node.right as Node, frame);
  ctx.emit(')');
};

export const compileOr = (ctx: Compiler, node: Node, frame: Frame): void => binOpEmitter(ctx, node, frame, ' || ');

export const compileAnd = (ctx: Compiler, node: Node, frame: Frame): void => binOpEmitter(ctx, node, frame, ' && ');

export const compileAdd = (ctx: Compiler, node: Node, frame: Frame): void => binOpEmitter(ctx, node, frame, ' + ');

export const compileConcat = (ctx: Compiler, node: Node, frame: Frame): void => binOpEmitter(ctx, node, frame, ' + "" + ');

export const compileSub = (ctx: Compiler, node: Node, frame: Frame): void => binOpEmitter(ctx, node, frame, ' - ');

export const compileMul = (ctx: Compiler, node: Node, frame: Frame): void => binOpEmitter(ctx, node, frame, ' * ');

export const compileDiv = (ctx: Compiler, node: Node, frame: Frame): void => binOpEmitter(ctx, node, frame, ' / ');

export const compileMod = (ctx: Compiler, node: Node, frame: Frame): void => binOpEmitter(ctx, node, frame, ' % ');

export const compileNullishCoalesce = (ctx: Compiler, node: Node, frame: Frame): void => {
  emitLocation(ctx, node);
  ctx.compile(node.left as Node, frame);
  ctx.emit(' ?? ');
  ctx.compile(node.right as Node, frame);
  ctx.emit(')');
};

export const compileIn = (ctx: Compiler, node: Node, frame: Frame): void => {
  const lineno = node.lineno ?? 0;
  const colno = node.colno ?? 0;
  ctx.emit('(lineno = ' + lineno + ', colno = ' + colno + ', runtime.inOperator(');
  ctx.compile(node.left as Node, frame);
  ctx.emit(',');
  ctx.compile(node.right as Node, frame);
  ctx.emit(', ' + lineno + ', ' + colno + '))');
};

export const compileFloorDiv = (ctx: Compiler, node: Node, frame: Frame): void => {
  emitLocation(ctx, node);
  ctx.emit('Math.floor(');
  ctx.compile(node.left as Node, frame);
  ctx.emit(' / ');
  ctx.compile(node.right as Node, frame);
  ctx.emit('))');
};

export const compilePow = (ctx: Compiler, node: Node, frame: Frame): void => {
  emitLocation(ctx, node);
  ctx.emit('Math.pow(');
  ctx.compile(node.left as Node, frame);
  ctx.emit(', ');
  ctx.compile(node.right as Node, frame);
  ctx.emit('))');
};
