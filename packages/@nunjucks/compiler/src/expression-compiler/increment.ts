import { isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

const compileIncrementDecrement = (ctx: Compiler, node: Node, frame: Frame, op: string): void => {
  const target = node.target as Node;
  const isSym = isSymbol(target);

  if (isSym) {
    const varName = target.value as string;
    const id = ctx.tmpid();

    ctx.emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', (() => {');
    ctx.emit('let ' + id + ' = runtime.contextOrFrameLookup(context, frame, "' + varName + '");');

    if (node.isPostfix) {
      ctx.emit('let result = ' + id + ';');
      ctx.emit(id + ' = ' + id + ' ' + op + ' 1;');
    } else {
      ctx.emit(id + ' = ' + id + ' ' + op + ' 1;');
      ctx.emit('let result = ' + id + ';');
    }

    ctx.emit('frame.set("' + varName + '", ' + id + ', true);');
    ctx.emit('context.setVariable("' + varName + '", ' + id + ');');
    ctx.emit('return result;');
    ctx.emit('})())');
  } else {
    ctx.emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', (() => { throw new Error("Invalid left-hand side expression"); })())');
  }
};

export const compileIncrement = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileIncrementDecrement(ctx, node, frame, '+');
};

export const compileDecrement = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileIncrementDecrement(ctx, node, frame, '-');
};
