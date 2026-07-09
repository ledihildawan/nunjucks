import { Symbol as ASTSymbol } from '../../nodes.js';
import { compileAggregate } from './container.js';

export const compilePipe = (ctx, node, frame) => {
  const name = node.name;
  ctx.assertType(name, ASTSymbol);
  ctx._emit('await runtime.awaitValue(env.getFilter("' + name.value + '").call(context, ');
  compileAggregate(ctx, node.args, frame);
  ctx._emit('))');
};

export const compilePipeAsync = (ctx, node, frame) => {
  const name = node.name;
  const symbol = node.symbol.value;

  ctx.assertType(name, ASTSymbol);

  frame.set(symbol, symbol);

  ctx._emitLine(`lineno = ${node.lineno}; colno = ${node.colno != null ? node.colno : 0};`);
  ctx._emit(symbol + ' = await runtime.awaitValue(env.getFilter("' + name.value + '").call(context, ');
  compileAggregate(ctx, node.args, frame);
  ctx._emitLine('));');
};
