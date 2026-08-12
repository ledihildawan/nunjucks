import { isFunCall } from '@nunjucks/nodes';
import type { Node, CompareNode, CompareOperandNode, BinaryNode } from '@nunjucks/nodes';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { emitLocationGuard } from '../codegen.ts';

export const compileCompare = (compiler: Compiler, { node, frame }: CompileNodeInput<CompareNode>): void => {
  const ops = node.ops;
  const first = ops[0] ?? node;
  emitLocationGuard(compiler, first.lineno, first.colno);
  compiler.compile(node.expr, frame);

  forEach(ops, (op) => {
    const operand = op as CompareOperandNode;
    compiler.emit(` ${operand.operator} `);
    emitLocationGuard(compiler, operand.lineno, operand.colno);
    compiler.compile(operand.expr, frame);
    compiler.emit(')');
  });
  compiler.emit(')');
};

export const compileIs = (compiler: Compiler, { node, frame }: CompileNodeInput<BinaryNode>): void => {
  const rightNode = node.right;
  let right: unknown;
  let args: readonly Node[] | undefined;
  if (isFunCall(rightNode)) {
    right = rightNode.name.value;
    args = rightNode.args;
  } else {
    right = rightNode.value;
  }
  const lineno = node.lineno;
  const colno = node.colno;
  emitLocationGuard(compiler, lineno, colno);
  compiler.emit(`env.getTest(${JSON.stringify(String(right))}, ${lineno}, ${colno}).call(context, `);
  compiler.compile(node.left, frame);
  if (args) {
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
