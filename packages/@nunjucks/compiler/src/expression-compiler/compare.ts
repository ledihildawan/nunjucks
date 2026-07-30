import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler } from '../index.ts';

export const compileCompare = (ctx: Compiler, node: Node, frame: Frame): void => {
  const ops = node.ops as Node[];
  const first = ops[0] ?? node;
  ctx.emit(`(lineno = ${first.lineno ?? node.lineno ?? 0}, colno = ${first.colno ?? node.colno ?? 0}, `);
  ctx.compile(node.expr as Node, frame);

  forEach(ops, op => {
    const operator = op.operator as string;
    ctx.emit(` ${operator} (lineno = ${op.lineno ?? node.lineno ?? 0}, colno = ${op.colno ?? node.colno ?? 0}, `);
    ctx.compile(op.expr as Node, frame);
    ctx.emit(')');
  });
  ctx.emit(')');
};

export const compileIs = (ctx: Compiler, node: Node, frame: Frame): void => {
  const rightNode = node.right as Node;
  const rightName = rightNode.name as Node | undefined;
  const right = (rightName ? rightName.value : rightNode.value) as unknown;
  const lineno = node.lineno ?? 0;
  const colno = node.colno ?? 0;
  ctx.emit(`(lineno = ${lineno}, colno = ${colno}, env.getTest(${JSON.stringify(String(right))}, ${lineno}, ${colno}).call(context, `);
  ctx.compile(node.left as Node, frame);
  if (rightNode.args) {
    ctx.emit(',');
    const args = rightNode.args as Node[];
    args.forEach((arg, i) => {
      if (i > 0) {
        ctx.emit(',');
      }
      ctx.compile(arg, frame);
    });
  }
  ctx.emit(') === true)');
};
