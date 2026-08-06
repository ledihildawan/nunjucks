import { isSymbol } from '@nunjucks/nodes';
import type { IncDecNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';

const compileIncrementDecrement = (ctx: Compiler, node: IncDecNode, _frame: Frame, op: string): void => {
  const target = node.target;
  const isSym = isSymbol(target);

  if (isSym) {
    const varName = target.value as string;
    const id = ctx.tmpid();

    emitLocationGuard(ctx, node.lineno, node.colno);
    ctx.emit('(() => {');
    ctx.emit(`let ${id} = runtime.contextOrFrameLookup(context, frame, "${varName}");`);

    if (node.isPostfix) {
      ctx.emit(`let result = ${id};`);
      ctx.emit(`${id} = ${id} ${op} 1;`);
    } else {
      ctx.emit(`${id} = ${id} ${op} 1;`);
      ctx.emit(`let result = ${id};`);
    }

    ctx.emit(`frame.set("${varName}", ${id}, true);`);
    ctx.emit(`context.setVariable("${varName}", ${id});`);
    ctx.emit('return result;');
    ctx.emit('})())');
  } else {
    emitLocationGuard(ctx, node.lineno, node.colno);
    ctx.emit('(() => { throw new Error("Invalid left-hand side expression"); })())');
  }
};

export const compileIncrement = (ctx: Compiler, node: IncDecNode, frame: Frame): void => {
  compileIncrementDecrement(ctx, node, frame, '+');
};

export const compileDecrement = (ctx: Compiler, node: IncDecNode, frame: Frame): void => {
  compileIncrementDecrement(ctx, node, frame, '-');
};
