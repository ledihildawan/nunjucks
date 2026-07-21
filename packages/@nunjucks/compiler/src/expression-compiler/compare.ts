import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

const compareOps: Record<string, string> = {
  '==': '==',
  '===': '===',
  '!=': '!=',
  '!==': '!==',
  '<': '<',
  '>': '>',
  '<=': '<=',
  '>=': '>='
};

export const compileCompare = (ctx: Compiler, node: Node, frame: Frame): void => {
  const ops = node.ops as Node[];
  const first = ops[0] ?? node;
  ctx._emit('(lineno = ' + (first.lineno ?? node.lineno ?? 0) + ', colno = ' + (first.colno ?? node.colno ?? 0) + ', ');
  ctx.compile(node.expr as Node, frame);

  ops.forEach((op) => {
    const operator = op.operator as string;
    ctx._emit(` ${compareOps[operator]} (lineno = ${op.lineno ?? node.lineno ?? 0}, colno = ${op.colno ?? node.colno ?? 0}, `);
    ctx.compile(op.expr as Node, frame);
    ctx._emit(')');
  });
  ctx._emit(')');
};

export const compileIs = (ctx: Compiler, node: Node, frame: Frame): void => {
  const rightNode = node.right as Node;
  const rightName = rightNode.name as Node | undefined;
  const right = rightName
    ? (rightName.value as unknown)
    : (rightNode.value as unknown);
  const lineno = node.lineno ?? 0;
  const colno = node.colno ?? 0;
  ctx._emit('(lineno = ' + lineno + ', colno = ' + colno + ', env.getTest(' + JSON.stringify(String(right)) + ', ' + lineno + ', ' + colno + ').call(context, ');
  ctx.compile(node.left as Node, frame);
  if (rightNode.args) {
    ctx._emit(',');
    ctx.compile(rightNode.args as Node, frame);
  }
  ctx._emit(') === true)');
};
