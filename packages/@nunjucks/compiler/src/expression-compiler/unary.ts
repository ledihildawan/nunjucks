import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

const compileUnary = (ctx: Compiler, node: Node, frame: Frame, operator: string): void => {
  ctx.emit(`(lineno = ${node.lineno ?? 0}, colno = ${node.colno ?? 0}, ${operator}`);
  ctx.compile(node.target as Node, frame);
  ctx.emit(')');
};

export const compileNot = (ctx: Compiler, node: Node, frame: Frame): void => compileUnary(ctx, node, frame, '!');

export const compileNeg = (ctx: Compiler, node: Node, frame: Frame): void => compileUnary(ctx, node, frame, '-');

export const compilePos = (ctx: Compiler, node: Node, frame: Frame): void => compileUnary(ctx, node, frame, '+');
