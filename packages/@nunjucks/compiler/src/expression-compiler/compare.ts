import type { BinaryNode, CompareNode, Node } from '@nunjucks/nodes';
import { isCompareOperand, isFunCall } from '@nunjucks/nodes';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../create-compiler.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

/**
 * Compiles chained comparisons by interleaving each operator with its own
 * location guard around the operands, closing one paren per comparison.
 */
export const compileCompare = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<CompareNode>
): void => {
  const ops = node.ops;
  const first = ops[0] ?? node;
  emitLocationGuard(compiler, first.lineno, first.colno);
  compiler.compile(node.expr, frame);

  for (const op of ops) {
    const operand = isCompareOperand(op) ? op : null;
    if (!operand) {
      continue;
    }
    compiler.emit(` ${operand.operator} `);
    emitLocationGuard(compiler, operand.lineno, operand.colno);
    compiler.compile(operand.expr, frame);
    compiler.emit(')');
  }
  compiler.emit(')');
};

/**
 * Compiles `is` to an `env.getTest(name, ...).call(context, left, ...args)`
 * invocation compared against `true`, treating a fun-call right operand's
 * name and args as the test reference.
 */
export const compileIs = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => {
  const rightOperand = node.right;
  const funCallRight = isFunCall(rightOperand) ? rightOperand : null;
  const args: readonly Node[] | undefined = funCallRight?.args;
  // WHY: a bare test operand names the test in its `.value`; a fun-call operand
  // references it by callee name — both are unknown-typed `.value` payloads, so the
  // String() coercion stays (single const, no reassignment).
  const right: unknown = funCallRight ? funCallRight.name.value : rightOperand.value;
  const lineno = node.lineno;
  const colno = node.colno;
  emitLocationGuard(compiler, lineno, colno);
  compiler.emit(
    `env.getTest(${JSON.stringify(String(right))}, ${lineno}, ${colno}).call(context, `
  );
  compiler.compile(node.left, frame);
  if (args) {
    // WHY: imperative index loop — comma placement between emitted fragments is
    // index-sensitive; a map().join() cannot interleave into the shared emit buffer.
    // Loop exemption: compiler emission path.
    for (let i = 0; i < args.length; i++) {
      const argument = args[i];
      if (i > 0) {
        compiler.emit(',');
      }
      if (argument) {
        compiler.compile(argument, frame);
      }
    }
  }
  compiler.emit(') === true)');
};
