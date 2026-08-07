import type { Node, BinaryNode, BinaryOpNode, RangeNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../codegen.ts';

const binOpEmitter = (compiler: Compiler, node: Node & { left: Node; right: Node }, frame: Frame, str: string): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.compile(node.left, frame);
  compiler.emit(str);
  compiler.compile(node.right, frame);
  compiler.emit(')');
};

export const compileOr = (compiler: Compiler, node: BinaryNode, frame: Frame): void => binOpEmitter(compiler, node, frame, ' || ');

export const compileAnd = (compiler: Compiler, node: BinaryNode, frame: Frame): void => binOpEmitter(compiler, node, frame, ' && ');

export const compileAdd = (compiler: Compiler, node: BinaryOpNode, frame: Frame): void => binOpEmitter(compiler, node, frame, ' + ');

export const compileConcat = (compiler: Compiler, node: BinaryNode, frame: Frame): void => binOpEmitter(compiler, node, frame, ' + "" + ');

export const compileRange = (compiler: Compiler, node: RangeNode, frame: Frame): void => {
  compiler.emit('(() => { let s = ');
  compiler.compile(node.left, frame);
  compiler.emit('; let e = ');
  compiler.compile(node.right, frame);
  compiler.emit('; let r = []; for (let i = s; i <= e; i++) { r.push(i); } return r; })()');
};

export const compileSub = (compiler: Compiler, node: BinaryOpNode, frame: Frame): void => binOpEmitter(compiler, node, frame, ' - ');

export const compileMul = (compiler: Compiler, node: BinaryOpNode, frame: Frame): void => binOpEmitter(compiler, node, frame, ' * ');

export const compileDiv = (compiler: Compiler, node: BinaryOpNode, frame: Frame): void => binOpEmitter(compiler, node, frame, ' / ');

export const compileMod = (compiler: Compiler, node: BinaryOpNode, frame: Frame): void => binOpEmitter(compiler, node, frame, ' % ');

export const compileNullishCoalesce = (compiler: Compiler, node: BinaryNode, frame: Frame): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.compile(node.left, frame);
  compiler.emit(' ?? ');
  compiler.compile(node.right, frame);
  compiler.emit(')');
};

export const compileIn = (compiler: Compiler, node: BinaryNode, frame: Frame): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  emitLocationGuard(compiler, lineno, colno);
  compiler.emit('runtime.inOperator(');
  compiler.compile(node.left, frame);
  compiler.emit(',');
  compiler.compile(node.right, frame);
  compiler.emit(`, ${lineno}, ${colno}))`);
};

export const compileFloorDiv = (compiler: Compiler, node: BinaryOpNode, frame: Frame): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit('Math.floor(');
  compiler.compile(node.left, frame);
  compiler.emit(' / ');
  compiler.compile(node.right, frame);
  compiler.emit('))');
};

export const compilePow = (compiler: Compiler, node: BinaryOpNode, frame: Frame): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit('Math.pow(');
  compiler.compile(node.left, frame);
  compiler.emit(', ');
  compiler.compile(node.right, frame);
  compiler.emit('))');
};
