import { nodes, NODE_TYPES } from '../../nodes/index.js';
import { compileAggregate } from './container.js';

const getNodeName = (ctx, node, isBracketCall = false) => {
  const typeName = nodes.getNodeTypeName(node);
  switch (typeName) {
    case 'symbol':
      return node.value;
    case 'funCall':
      return 'the return value of (' + getNodeName(ctx, node.name) + ')';
    case 'lookupVal': {
      const target = getNodeName(ctx, node.target);
      const isBracket = node[NODE_TYPES.BracketNotation] === true;
      if (nodes.isSymbol(node.val)) {
        return target + (isBracket ? '[' + getNodeName(ctx, node.val) + ']' : '.' + getNodeName(ctx, node.val));
      }
      if (nodes.isLiteral(node.val) && typeof node.val.value === 'string') {
        return target + (isBracket ? '["' + node.val.value + '"]' : '.' + node.val.value);
      }
      return target + '[' + getNodeName(ctx, node.val) + ']';
    }
    case 'optionalChain': {
      const target = getNodeName(ctx, node.target);
      const isBracket = node[NODE_TYPES.BracketNotation] === true;
      if (nodes.isSymbol(node.val)) {
        return target + (isBracket ? '?.[' + getNodeName(ctx, node.val) + ']' : '?.' + getNodeName(ctx, node.val));
      }
      if (nodes.isLiteral(node.val) && typeof node.val.value === 'string') {
        return target + (isBracket ? '?.["' + node.val.value + '"]' : '?.' + node.val.value);
      }
      return target + '?.[' + getNodeName(ctx, node.val) + ']';
    }
    case 'literal':
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

  const funcName = getNodeName(ctx, node.name);
  const displayName = funcName + '()';
  ctx._emit(', "' + funcName.replace(/"/g, '\\"') + '", "' + displayName.replace(/"/g, '\\"') + '", context, ');

  compileAggregate(ctx, node.args, frame, '[', '], ' + node.lineno + ', ' + node.colno + '))');
};
