import type { UnaryOpNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../codegen.ts';

const compileUnary = (compiler: Compiler, node: UnaryOpNode, frame: Frame, operator: string): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit(operator);
  compiler.compile(node.target, frame);
  compiler.emit(')');
};

export const compileNot = (compiler: Compiler, node: UnaryOpNode, frame: Frame): void => compileUnary(compiler, node, frame, '!');

export const compileNeg = (compiler: Compiler, node: UnaryOpNode, frame: Frame): void => compileUnary(compiler, node, frame, '-');

export const compilePos = (compiler: Compiler, node: UnaryOpNode, frame: Frame): void => compileUnary(compiler, node, frame, '+');
