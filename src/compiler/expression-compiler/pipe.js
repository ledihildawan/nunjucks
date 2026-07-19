import { compileAggregate } from './container.js';

export const compilePipe = (ctx, node, frame) => {
  const name = node.name;
  ctx.assertType(name, 'symbol');
  const filterName = String(name.value);
  const location = `${node.lineno}, ${node.colno != null ? node.colno : 0}`;
  ctx._emit(`await runtime.awaitValue(env.getFilter("${filterName}", ${location}).call(context, `);
  compileAggregate(ctx, node.args, frame);
  ctx._emit('))');
};

export const compilePipeAsync = (ctx, node, frame) => {
  const name = node.name;
  const symbol = node.symbol.value;

  ctx.assertType(name, 'symbol');

  frame.set(symbol, symbol);

  const filterName = String(name.value);
  const location = `${node.lineno}, ${node.colno != null ? node.colno : 0}`;
  ctx._emit(symbol + ' = await runtime.awaitValue(env.getFilter("' + filterName + '", ' + location + ').call(context, ');
  compileAggregate(ctx, node.args, frame);
  ctx._emitLine('));');
};
