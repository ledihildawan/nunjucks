import { AstSymbol } from '../../nodes/index.js';
import { compileAggregate } from './container.js';

const getNodeName = (ctx, node) => {
  switch (node.typename) {
    case 'Symbol':
      return node.value;
    case 'FunCall':
      return 'the return value of (' + getNodeName(ctx, node.name) + ')';
    case 'LookupVal':
      return getNodeName(ctx, node.target) + '["' +
        getNodeName(ctx, node.val) + '"]';
    case 'OptionalChain':
      return getNodeName(ctx, node.target) + '?.["' +
        getNodeName(ctx, node.val) + '"]';
    case 'Literal':
      return node.value.toString();
    default:
      return '--expression--';
  }
};

export const compileFunCall = (ctx, node, frame) => {
  ctx._emit('(lineno = ' + node.lineno +
    ', colno = ' + node.colno + ', ');

  ctx._emit('runtime.callWrap(');
  ctx._compileExpression(node.name, frame);

  ctx._emit(', "' + getNodeName(ctx, node.name).replace(/"/g, '\\"') + '", context, ');

  compileAggregate(ctx, node.args, frame, '[', '], ' + node.lineno + ', ' + node.colno + '))');
};
