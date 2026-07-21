import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileDestructuring } from '../statement-compiler/pattern.ts';

export const compileInlineIf = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx._emit('(');
  ctx.compile(node.cond as Node, frame);
  ctx._emit('?');
  ctx.compile(node.body as Node, frame);
  ctx._emit(':');
  if (node.else_ !== null) {
    ctx.compile(node.else_ as Node, frame);
  } else {
    ctx._emit('""');
  }
  ctx._emit(')');
};

export const compileWalrus = (ctx: Compiler, node: Node, frame: Frame): void => {
  if (nodes.isSymbol(node.target as Node)) {
    const target = node.target as Node;
    const valueId = ctx._tmpid();
    ctx._emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', (() => {');
    ctx._emit('let ' + valueId + ' = ');
    ctx.compile(node.value as Node, frame);
    ctx._emit(';');
    ctx._emit('frame.set(' + JSON.stringify(target.value) + ', ' + valueId + ', true);');
    ctx._emit('return ' + valueId + ';');
    ctx._emit('})())');
  } else if (nodes.isArrayPattern(node.target as Node) || nodes.isObjectPattern(node.target as Node)) {
    const target = node.target as Node;
    const valueId = ctx._tmpid();
    ctx._emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', (() => {');
    ctx._emit('let ' + valueId + ' = ');
    ctx.compile(node.value as Node, frame);
    ctx._emit(';');
    compileDestructuring(ctx, frame, target, valueId, false);
    ctx._emit('return ' + valueId + ';');
    ctx._emit('})())');
  } else {
    ctx.fail('Walrus target must be a symbol or destructuring pattern', node.lineno, node.colno);
  }
};
