import { isFunCall } from '@nunjucks/nodes';
import type { Node, CompareNode, CompareOperandNode, BinaryNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';

export const compileCompare = (ctx: Compiler, node: CompareNode, frame: Frame): void => {
  const ops = node.ops;
  const first = ops[0] ?? node;
  emitLocationGuard(ctx, first.lineno, first.colno);
  ctx.compile(node.expr, frame);

  forEach(ops, (op) => {
    const operand = op as CompareOperandNode;
    ctx.emit(` ${operand.operator} `);
    emitLocationGuard(ctx, operand.lineno, operand.colno);
    ctx.compile(operand.expr, frame);
    ctx.emit(')');
  });
  ctx.emit(')');
};

export const compileIs = (ctx: Compiler, node: BinaryNode, frame: Frame): void => {
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
  emitLocationGuard(ctx, lineno, colno);
  ctx.emit(`env.getTest(${JSON.stringify(String(right))}, ${lineno}, ${colno}).call(context, `);
  ctx.compile(node.left, frame);
  if (args) {
    ctx.emit(',');
    for (let i = 0; i < args.length; i++) {
      if (i > 0) {
        ctx.emit(',');
      }
      const arg = args[i];
      if (arg) {
        ctx.compile(arg, frame);
      }
    }
  }
  ctx.emit(') === true)');
};
