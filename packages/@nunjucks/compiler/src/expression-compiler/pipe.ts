import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileAggregate } from './container.ts';

const getInputVarPath = (node: Node | undefined): string | null => {
  if (!node) return null;

  if (node.type === 'symbol') {
    return node.value as string;
  }

  if ((node.type as string) === 'getattr' || node.type === 'lookupVal') {
    const parts: unknown[] = [];
    let curr: Node | undefined = node;

    while (curr && ((curr.type as string) === 'getattr' || curr.type === 'lookupVal')) {
      if ((curr.type as string) === 'getattr') {
        parts.unshift(curr.attr);
      } else if (curr.type === 'lookupVal') {
        const val = curr.val as Node;
        parts.unshift(typeof val?.value === 'string' ? val.value : val);
      }
      curr = curr.target as Node;
    }

    if (curr && curr.type === 'symbol') {
      parts.unshift(curr.value);
      return parts.join('.');
    }
  }

  return null;
};

const getInputVarLocation = (node: Node | undefined): string | null => {
  if (!node) return null;

  if (node.type === 'symbol') {
    return `${node.lineno ?? 0}, ${node.colno ?? 0}`;
  }

  if ((node.type as string) === 'getattr') {
    return `${node.lineno ?? 0}, ${node.colno ?? 0}`;
  }

  if (node.type === 'lookupVal') {
    const val = node.val as Node | undefined;
    if (val) {
      return `${val.lineno ?? 0}, ${val.colno ?? 0}`;
    }
    return `${node.lineno ?? 0}, ${node.colno ?? 0}`;
  }

  return `${node.lineno ?? 0}, ${node.colno ?? 0}`;
};

export const compilePipe = (ctx: Compiler, node: Node, frame: Frame): void => {
  const name = node.name as Node;
  ctx.assertType(name, 'symbol');
  const filterName = String(name.value);
  const filterLocation = `${node.lineno}, ${node.colno != null ? node.colno : 0}`;

  const argsChildren = (node.args as Node | undefined)?.children || [];
  const firstArg = argsChildren[0];
  const inputVar = firstArg ? getInputVarPath(firstArg) : null;
  const inputLocation = firstArg ? getInputVarLocation(firstArg) : null;

  if (inputVar && inputLocation) {
    ctx._emit(`await runtime.awaitValue(env.getFilter("${filterName}", ${filterLocation}, ${inputLocation}, "${inputVar}").call(context, `);
  } else {
    ctx._emit(`await runtime.awaitValue(env.getFilter("${filterName}", ${filterLocation}).call(context, `);
  }

  compileAggregate(ctx, node.args as Node, frame);
  ctx._emit('))');
};

export const compilePipeAsync = (ctx: Compiler, node: Node, frame: Frame): void => {
  const name = node.name as Node;
  const symbol = (node.symbol as Node).value as string;

  ctx.assertType(name, 'symbol');

  frame.set(symbol, symbol);

  const filterName = String(name.value);
  const filterLocation = `${node.lineno}, ${node.colno != null ? node.colno : 0}`;

  const argsChildren = (node.args as Node | undefined)?.children || [];
  const firstArg = argsChildren[0];
  const inputVar = firstArg ? getInputVarPath(firstArg) : null;
  const inputLocation = firstArg ? getInputVarLocation(firstArg) : null;

  if (inputVar && inputLocation) {
    ctx._emit(symbol + ' = await runtime.awaitValue(env.getFilter("' + filterName + '", ' + filterLocation + ', ' + inputLocation + ', "' + inputVar + '").call(context, ');
  } else {
    ctx._emit(symbol + ' = await runtime.awaitValue(env.getFilter("' + filterName + '", ' + filterLocation + ').call(context, ');
  }

  compileAggregate(ctx, node.args as Node, frame);
  ctx._emitLine('));');
};
