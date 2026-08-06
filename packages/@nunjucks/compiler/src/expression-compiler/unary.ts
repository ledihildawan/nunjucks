import type { UnaryOpNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';

const compileUnary = (ctx: Compiler, node: UnaryOpNode, frame: Frame, operator: string): void => {
  emitLocationGuard(ctx, node.lineno, node.colno);
  ctx.emit(operator);
  ctx.compile(node.target, frame);
  ctx.emit(')');
};

export const compileNot = (ctx: Compiler, node: UnaryOpNode, frame: Frame): void => compileUnary(ctx, node, frame, '!');

export const compileNeg = (ctx: Compiler, node: UnaryOpNode, frame: Frame): void => compileUnary(ctx, node, frame, '-');

export const compilePos = (ctx: Compiler, node: UnaryOpNode, frame: Frame): void => compileUnary(ctx, node, frame, '+');
