import { compileAggregate } from './container.js';

export const compilePipe = (ctx, node, frame) => {
  const name = node.name;
  ctx.assertType(name, 'symbol');
  ctx._emit('await runtime.awaitValue(env.getFilter("' + name.value + '", ' + node.lineno + ', ' + (node.colno != null ? node.colno : 0) + ').call(context, ');
  compileAggregate(ctx, node.args, frame);
  ctx._emit('))');
};

export const compilePipeAsync = (ctx, node, frame) => {
  const name = node.name;
  const symbol = node.symbol.value;

  ctx.assertType(name, 'symbol');

  frame.set(symbol, symbol);

  ctx._emit(symbol + ' = await runtime.awaitValue(env.getFilter("' + name.value + '", ' + node.lineno + ', ' + (node.colno != null ? node.colno : 0) + ').call(context, ');
  compileAggregate(ctx, node.args, frame);
  ctx._emitLine('));');
};
