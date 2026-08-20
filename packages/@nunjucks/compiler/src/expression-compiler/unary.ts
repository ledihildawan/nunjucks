import type { UnaryOpNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

interface UnaryOperatorOptions {
  operator: string;
}

// WHY: private helper consumed by compileNeg/compilePos — not a dispatch target,
// so the 3-positional-plus-options shape is contained and acceptable here.
const compileUnary = (
  compiler: Compiler,
  node: UnaryOpNode,
  frame: Frame,
  { operator }: UnaryOperatorOptions
): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  compiler.emit(operator);
  compiler.compile(node.target, frame);
  compiler.emit(')');
};

/**
 * Compiles `not` to `(!runtime.isTruthy(target))` so miss sentinels stay
 * falsy; the third closer balances the location guard's opening paren.
 */
export const compileNot = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<UnaryOpNode>
): void => {
  emitLocationGuard(compiler, node.lineno, node.colno);
  // WHY: isTruthy (not raw !) so miss sentinels count as falsy under `not` too. Three
  // closers: isTruthy arg, the NOT group, and the location guard's opening paren.
  compiler.emit('(!runtime.isTruthy(');
  compiler.compile(node.target, frame);
  compiler.emit(')))');
};

/** Compiles unary `-` as a location-guarded prefix on the operand. */
export const compileNeg = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<UnaryOpNode>
): void => compileUnary(compiler, node, frame, { operator: '-' });

/** Compiles unary `+` as a location-guarded prefix on the operand. */
export const compilePos = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<UnaryOpNode>
): void => compileUnary(compiler, node, frame, { operator: '+' });
