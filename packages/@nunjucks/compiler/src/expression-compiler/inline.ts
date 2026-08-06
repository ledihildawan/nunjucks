import { isArrayPattern, isObjectPattern, isSymbol } from '@nunjucks/nodes';
import type { IfNode, WalrusNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';
import { compileDestructuring } from '../statement-compiler/pattern.ts';

export const compileInlineIf = (ctx: Compiler, node: IfNode, frame: Frame): void => {
  ctx.emit('(');
  ctx.compile(node.cond, frame);
  ctx.emit('?');
  ctx.compile(node.body, frame);
  ctx.emit(':');
  if (node.else_ === null) {
    ctx.emit('""');
  } else {
    ctx.compile(node.else_, frame);
  }
  ctx.emit(')');
};

export const compileWalrus = (ctx: Compiler, node: WalrusNode, frame: Frame): void => {
  if (isSymbol(node.target)) {
    const target = node.target;
    const valueId = ctx.tmpid();
    emitLocationGuard(ctx, node.lineno, node.colno);
    ctx.emit('(() => {');
    ctx.emit(`let ${valueId} = `);
    ctx.compile(node.value, frame);
    ctx.emit(';');
    ctx.emit(`frame.set(${JSON.stringify(target.value)}, ${valueId}, true);`);
    ctx.emit(`return ${valueId};`);
    ctx.emit('})())');
  } else if (isArrayPattern(node.target) || isObjectPattern(node.target)) {
    const target = node.target;
    const valueId = ctx.tmpid();
    emitLocationGuard(ctx, node.lineno, node.colno);
    ctx.emit('(() => {');
    ctx.emit(`let ${valueId} = `);
    ctx.compile(node.value, frame);
    ctx.emit(';');
    compileDestructuring({ ctx, frame, registerFrame: false }, target, valueId);
    ctx.emit(`return ${valueId};`);
    ctx.emit('})())');
  } else {
    ctx.fail('Walrus target must be a symbol or destructuring pattern', node.lineno, node.colno);
  }
};
