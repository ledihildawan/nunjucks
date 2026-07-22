import { isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';

const compileIncrementDecrement = (ctx: Compiler, node: Node, frame: Frame, op: string): void => {
  const target = node.target as Node;
  const isSym = isSymbol(target);

  if (isSym) {
    const varName = target.value as string;
    const id = ctx._tmpid();

    ctx._emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', (() => {');
    ctx._emit('let ' + id + ' = runtime.contextOrFrameLookup(context, frame, "' + varName + '");');

    if (node.isPostfix) {
      ctx._emit('let result = ' + id + ';');
      ctx._emit(id + ' = ' + id + ' ' + op + ' 1;');
    } else {
      ctx._emit(id + ' = ' + id + ' ' + op + ' 1;');
      ctx._emit('let result = ' + id + ';');
    }

    ctx._emit('frame.set("' + varName + '", ' + id + ', true);');
    ctx._emit('context.setVariable("' + varName + '", ' + id + ');');
    ctx._emit('return result;');
    ctx._emit('})())');
  } else {
    ctx._emit('(lineno = ' + (node.lineno ?? 0) + ', colno = ' + (node.colno ?? 0) + ', (() => { throw new Error("Invalid left-hand side expression"); })())');
  }
};

export const compileIncrement = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileIncrementDecrement(ctx, node, frame, '+');
};

export const compileDecrement = (ctx: Compiler, node: Node, frame: Frame): void => {
  compileIncrementDecrement(ctx, node, frame, '-');
};
