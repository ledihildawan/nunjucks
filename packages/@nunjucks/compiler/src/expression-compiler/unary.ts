import type { UnaryOpNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../codegen.ts';

interface UnaryOperatorOptions {
  operator: string;
}

const compileUnary = (compiler: Compiler, node: UnaryOpNode, frame: Frame, { operator }: UnaryOperatorOptions): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit(operator);
  compiler.compile(node.target, frame);
  compiler.emit(')');
};

export const compileNot = (compiler: Compiler, node: UnaryOpNode, frame: Frame): void => compileUnary(compiler, node, frame, { operator: '!' });

export const compileNeg = (compiler: Compiler, node: UnaryOpNode, frame: Frame): void => compileUnary(compiler, node, frame, { operator: '-' });

export const compilePos = (compiler: Compiler, node: UnaryOpNode, frame: Frame): void => compileUnary(compiler, node, frame, { operator: '+' });
