import { isArrayPattern, isObjectPattern, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileDestructuring } from '../statement-compiler/pattern.ts';

export const compileInlineIf = (ctx: Compiler, node: Node, frame: Frame): void => {
  ctx.emit('(');
  ctx.compile(node.cond as Node, frame);
  ctx.emit('?');
  ctx.compile(node.body as Node, frame);
  ctx.emit(':');
  if (node.else_ !== null) {
    ctx.compile(node.else_ as Node, frame);
  } else {
    ctx.emit('""');
  }
  ctx.emit(')');
};

export const compileWalrus = (ctx: Compiler, node: Node, frame: Frame): void => {
  if (isSymbol(node.target as Node)) {
    const target = node.target as Node;
    const valueId = ctx.tmpid();
    ctx.emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', (() => {');
    ctx.emit('let ' + valueId + ' = ');
    ctx.compile(node.value as Node, frame);
    ctx.emit(';');
    ctx.emit('frame.set(' + JSON.stringify(target.value) + ', ' + valueId + ', true);');
    ctx.emit('return ' + valueId + ';');
    ctx.emit('})())');
  } else if (isArrayPattern(node.target as Node) || isObjectPattern(node.target as Node)) {
    const target = node.target as Node;
    const valueId = ctx.tmpid();
    ctx.emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', (() => {');
    ctx.emit('let ' + valueId + ' = ');
    ctx.compile(node.value as Node, frame);
    ctx.emit(';');
    compileDestructuring(ctx, frame, target, valueId, false);
    ctx.emit('return ' + valueId + ';');
    ctx.emit('})())');
  } else {
    ctx.fail('Walrus target must be a symbol or destructuring pattern', node.lineno, node.colno);
  }
};
