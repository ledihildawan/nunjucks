import { ERROR_CODES } from '@nunjucks/error-catalog';
import type { BinaryNode, BinaryOpNode, Node, RangeNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

interface BinOpEmitterOptions {
  compiler: Compiler;
  node: Node & { left: Node; right: Node };
  frame: Frame;
  operator: string;
}

/** Emits a location-guarded `(left op right)` pair shared by every plain binary operator. */
export const binOpEmitter = ({ compiler, node, frame, operator }: BinOpEmitterOptions): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.compile(node.left, frame);
  compiler.emit(operator);
  compiler.compile(node.right, frame);
  compiler.emit(')');
};

/** Compiles `||` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileOr = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' || ' });

/** Compiles `&&` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileAnd = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' && ' });

/** Compiles `+` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileAdd = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' + ' });

/** Compiles `~` to ` + "" + `, forcing string concatenation on both operands. */
export const compileConcat = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' + "" + ' });

// WHY: an unbounded `..` range is a render-time DoS vector (`{{ (-1/0)..(1/0) }}` hangs
// forever, `1..1e9` memory-blows), so the emitted code validates integer bounds and a
// finite span BEFORE materializing and throws a coded error the runtime funnel
// classifies as RANGE_EXCEEDED.
const MAX_RANGE_SPAN = 1_000_000;

/**
 * Compiles `..` into an awaited async IIFE that validates integer bounds and
 * the `MAX_RANGE_SPAN` limit before materializing the array.
 */
export const compileRange = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<RangeNode>
): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  // WHY: awaited async IIFE — the bound subtrees may contain pipe/test calls whose
  // emission embeds `await`; a sync IIFE would emit invalid generated JS.
  compiler.emit('await (async () => { let s = ');
  compiler.compile(node.left, frame);
  compiler.emit('; let e = ');
  compiler.compile(node.right, frame);
  compiler.emit(
    `; if (!Number.isInteger(s) || !Number.isInteger(e) || Math.abs(e - s) > ${MAX_RANGE_SPAN}) { const rangeError = new Error('range: ' + s + '..' + e); rangeError.code = ${JSON.stringify(ERROR_CODES.RANGE_EXCEEDED)}; throw rangeError; } let r = []; for (let i = s; i <= e; i++) { r.push(i); } return r; })()`
  );
  compiler.emit(')');
};

/** Compiles `-` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileSub = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' - ' });

/** Compiles `*` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileMul = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' * ' });

/** Compiles `/` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileDiv = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' / ' });

/** Compiles `%` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileMod = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryOpNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' % ' });

/** Compiles `??` as a location-guarded left/right pair via `binOpEmitter`. */
export const compileNullishCoalesce = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => binOpEmitter({ compiler, node, frame, operator: ' ?? ' });

/** Compiles `in` to a `runtime.inOperator({ key, value, lineno, colno })` call. */
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

/** Compiles `//` to `Math.floor(left / right)` behind a location guard. */
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

/** Compiles `**` to `Math.pow(left, right)` behind a location guard. */
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
