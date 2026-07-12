import { isSymbol, isLiteral, getNodeTypeName, BracketNotation } from '../../nodes/index.js';
import { compileAggregate } from './container.js';

const getNodeName = (ctx, node, isBracketCall = false) => {
  const typeName = getNodeTypeName(node);
  switch (typeName) {
    case 'Symbol':
      return node.value;
    case 'FunCall':
      return 'the return value of (' + getNodeName(ctx, node.name) + ')';
    case 'LookupVal': {
      const target = getNodeName(ctx, node.target);
      const isBracket = node[BracketNotation] === true;
      if (isSymbol(node.val)) {
        return target + (isBracket ? '[' + getNodeName(ctx, node.val) + ']' : '.' + getNodeName(ctx, node.val));
      }
      if (isLiteral(node.val) && typeof node.val.value === 'string') {
        return target + (isBracket ? '["' + node.val.value + '"]' : '.' + node.val.value);
      }
      return target + '[' + getNodeName(ctx, node.val) + ']';
    }
    case 'OptionalChain': {
      const target = getNodeName(ctx, node.target);
      const isBracket = node[BracketNotation] === true;
      if (isSymbol(node.val)) {
        return target + (isBracket ? '?.[' + getNodeName(ctx, node.val) + ']' : '?.' + getNodeName(ctx, node.val));
      }
      if (isLiteral(node.val) && typeof node.val.value === 'string') {
        return target + (isBracket ? '?.["' + node.val.value + '"]' : '?.' + node.val.value);
      }
      return target + '?.[' + getNodeName(ctx, node.val) + ']';
    }
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

  const funcName = getNodeName(ctx, node.name);
  const displayName = funcName + '()';
  ctx._emit(', "' + funcName.replace(/"/g, '\\"') + '", "' + displayName.replace(/"/g, '\\"') + '", context, ');

  compileAggregate(ctx, node.args, frame, '[', '], ' + node.lineno + ', ' + node.colno + '))');
};
