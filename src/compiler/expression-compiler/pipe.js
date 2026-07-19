import { compileAggregate } from './container.js';

const getInputVarPath = (node) => {
  if (!node) return null;
  
  if (node.type === 'symbol') {
    return node.value;
  }
  
  if (node.type === 'getattr' || node.type === 'lookupVal') {
    const parts = [];
    let curr = node;
    
    while (curr.type === 'getattr' || curr.type === 'lookupVal') {
      if (curr.type === 'getattr') {
        parts.unshift(curr.attr);
      } else if (curr.type === 'lookupVal') {
        parts.unshift(typeof curr.val?.value === 'string' ? curr.val.value : curr.val);
      }
      curr = curr.target;
    }
    
    if (curr.type === 'symbol') {
      parts.unshift(curr.value);
      return parts.join('.');
    }
  }
  
  return null;
};

const getInputVarLocation = (node) => {
  if (!node) return null;
  
  if (node.type === 'symbol') {
    return `${node.lineno ?? 0}, ${node.colno ?? 0}`;
  }
  
  if (node.type === 'getattr') {
    return `${node.lineno ?? 0}, ${node.colno ?? 0}`;
  }
  
  if (node.type === 'lookupVal') {
    if (node.val) {
      return `${node.val.lineno ?? 0}, ${node.val.colno ?? 0}`;
    }
    return `${node.lineno ?? 0}, ${node.colno ?? 0}`;
  }
  
  return `${node.lineno ?? 0}, ${node.colno ?? 0}`;
};

export const compilePipe = (ctx, node, frame) => {
  const name = node.name;
  ctx.assertType(name, 'symbol');
  const filterName = String(name.value);
  const filterLocation = `${node.lineno}, ${node.colno != null ? node.colno : 0}`;
  
  const argsChildren = node.args?.children || [];
  const firstArg = argsChildren[0];
  const inputVar = firstArg ? getInputVarPath(firstArg) : null;
  const inputLocation = firstArg ? getInputVarLocation(firstArg) : null;
  
  if (inputVar && inputLocation) {
    ctx._emit(`await runtime.awaitValue(env.getFilter("${filterName}", ${filterLocation}, ${inputLocation}, "${inputVar}").call(context, `);
  } else {
    ctx._emit(`await runtime.awaitValue(env.getFilter("${filterName}", ${filterLocation}).call(context, `);
  }
  
  compileAggregate(ctx, node.args, frame);
  ctx._emit('))');
};

export const compilePipeAsync = (ctx, node, frame) => {
  const name = node.name;
  const symbol = node.symbol.value;

  ctx.assertType(name, 'symbol');

  frame.set(symbol, symbol);

  const filterName = String(name.value);
  const filterLocation = `${node.lineno}, ${node.colno != null ? node.colno : 0}`;
  
  const argsChildren = node.args?.children || [];
  const firstArg = argsChildren[0];
  const inputVar = firstArg ? getInputVarPath(firstArg) : null;
  const inputLocation = firstArg ? getInputVarLocation(firstArg) : null;
  
  if (inputVar && inputLocation) {
    ctx._emit(symbol + ' = await runtime.awaitValue(env.getFilter("' + filterName + '", ' + filterLocation + ', ' + inputLocation + ', "' + inputVar + '").call(context, ');
  } else {
    ctx._emit(symbol + ' = await runtime.awaitValue(env.getFilter("' + filterName + '", ' + filterLocation + ').call(context, ');
  }
  
  compileAggregate(ctx, node.args, frame);
  ctx._emitLine('));');
};
