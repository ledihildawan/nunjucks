import { nodes } from '../../nodes/index.js';

const compileIncrementDecrement = (ctx, node, frame, op) => {
  const target = node.target;
  const isSymbol = nodes.isSymbol(target);
  
  if (isSymbol) {
    const varName = target.value;
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

export const compileIncrement = (ctx, node, frame) => {
  compileIncrementDecrement(ctx, node, frame, '+');
};

export const compileDecrement = (ctx, node, frame) => {
  compileIncrementDecrement(ctx, node, frame, '-');
};
