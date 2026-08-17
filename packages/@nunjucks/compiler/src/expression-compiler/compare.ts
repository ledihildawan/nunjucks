import type { BinaryNode, CompareNode, Node } from '@nunjucks/nodes';
import { isCompareOperand, isFunCall } from '@nunjucks/nodes';
import { forEach } from 'remeda';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';

export const compileCompare = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<CompareNode>
): void => {
  const ops = node.ops;
  const first = ops[0] ?? node;
  emitLocationGuard(compiler, first.lineno, first.colno);
  compiler.compile(node.expr, frame);

  forEach(ops, (op) => {
    const operand = isCompareOperand(op) ? op : null;
    if (!operand) {
      return;
    }
    compiler.emit(` ${operand.operator} `);
    emitLocationGuard(compiler, operand.lineno, operand.colno);
    compiler.compile(operand.expr, frame);
    compiler.emit(')');
  });
  compiler.emit(')');
};

export const compileIs = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<BinaryNode>
): void => {
  const rightOperand = node.right;
  let right: unknown;
  let args: readonly Node[] | undefined;
  if (isFunCall(rightOperand)) {
    right = rightOperand.name.value;
    args = rightOperand.args;
  } else {
    right = rightOperand.value;
  }
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
    // Loop exemption: compiler emission path, per ARCHITECTURE.md.
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
