import type { BinaryNode, BinaryOpNode, Node, RangeNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

interface BinOpEmitterOptions {
  operator: string;
}

const binOpEmitter = (
  compiler: Compiler,
  node: Node & { left: Node; right: Node },
  frame: Frame,
  options: BinOpEmitterOptions
): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.compile(node.left, frame);
  compiler.emit(options.operator);
  compiler.compile(node.right, frame);
  compiler.emit(')');
};

export const compileOr = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter(compiler, node, frame, { operator: ' || ' });

export const compileAnd = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter(compiler, node, frame, { operator: ' && ' });

export const compileAdd = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter(compiler, node, frame, { operator: ' + ' });

export const compileConcat = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter(compiler, node, frame, { operator: ' + "" + ' });

export const compileRange = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<RangeNode>
): void => {
  compiler.emit('(() => { let s = ');
  compiler.compile(node.left, frame);
  compiler.emit('; let e = ');
  compiler.compile(node.right, frame);
  compiler.emit('; let r = []; for (let i = s; i <= e; i++) { r.push(i); } return r; })()');
};

export const compileSub = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter(compiler, node, frame, { operator: ' - ' });

export const compileMul = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter(compiler, node, frame, { operator: ' * ' });

export const compileDiv = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter(compiler, node, frame, { operator: ' / ' });

export const compileMod = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter(compiler, node, frame, { operator: ' % ' });

export const compileNullishCoalesce = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.compile(node.left, frame);
  compiler.emit(' ?? ');
  compiler.compile(node.right, frame);
  compiler.emit(')');
};

export const compileIn = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => {
  const lineno = node.lineno;
  const colno = node.colno;
  emitLocationGuard(compiler, lineno, colno);
  compiler.emit('runtime.inOperator({ key: ');
  compiler.compile(node.left, frame);
  compiler.emit(', value: ');
  compiler.compile(node.right, frame);
  compiler.emit(`, lineno: ${lineno}, colno: ${colno} }))`);
};

export const compileFloorDiv = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit('Math.floor(');
  compiler.compile(node.left, frame);
  compiler.emit(' / ');
  compiler.compile(node.right, frame);
  compiler.emit('))');
};

export const compilePow = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit('Math.pow(');
  compiler.compile(node.left, frame);
  compiler.emit(', ');
  compiler.compile(node.right, frame);
  compiler.emit('))');
};
