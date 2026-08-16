import { ERROR_CODES } from '@nunjucks/error-catalog';
import type { BinaryNode, BinaryOpNode, Node, RangeNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

interface BinOpEmitterOptions {
  compiler: Compiler;
  node: Node & { left: Node; right: Node };
  frame: Frame;
  operator: string;
}

const binOpEmitter = ({ compiler, node, frame, operator }: BinOpEmitterOptions): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.compile(node.left, frame);
  compiler.emit(operator);
  compiler.compile(node.right, frame);
  compiler.emit(')');
};

export const compileOr = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' || ' });

export const compileAnd = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' && ' });

export const compileAdd = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' + ' });

export const compileConcat = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' + "" + ' });

// WHY: an unbounded `..` range is a render-time DoS vector (`{{ (-1/0)..(1/0) }}` hangs
// forever, `1..1e9` memory-blows), so the emitted code validates integer bounds and a
// finite span BEFORE materializing and throws a coded error the runtime funnel
// classifies as RANGE_EXCEEDED.
const MAX_RANGE_SPAN = 1_000_000;

export const compileRange = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<RangeNode>
): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit('(() => { let s = ');
  compiler.compile(node.left, frame);
  compiler.emit('; let e = ');
  compiler.compile(node.right, frame);
  compiler.emit(
    `; if (!Number.isInteger(s) || !Number.isInteger(e) || Math.abs(e - s) > ${MAX_RANGE_SPAN}) { const rangeError = new Error('range: ' + s + '..' + e); rangeError.code = ${JSON.stringify(ERROR_CODES.RANGE_EXCEEDED)}; throw rangeError; } let r = []; for (let i = s; i <= e; i++) { r.push(i); } return r; })()`
  );
  compiler.emit(')');
};

export const compileSub = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' - ' });

export const compileMul = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' * ' });

export const compileDiv = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' / ' });

export const compileMod = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' % ' });

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
