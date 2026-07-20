import { nodes, BracketNotation } from '../../nodes/index.js';
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
      const isBracket = node[BracketNotation] === true;
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
      const isBracket = node[BracketNotation] === true;
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

const getCallLocation = (node) => {
  if (nodes.isLookupVal(node.name) && node.name.val?.lineno != null && node.name.val?.colno != null) {
    const isQuotedBracketString = node.name[BracketNotation] === true &&
      nodes.isLiteral(node.name.val) &&
      typeof node.name.val.value === 'string';
    return {
      lineno: node.name.val.lineno,
      colno: node.name.val.colno + (isQuotedBracketString ? 1 : 0)
    };
  }

  return {
    lineno: node.name?.lineno ?? node.lineno,
    colno: node.name?.colno ?? node.colno
  };
};

export const compileFunCall = (ctx, node, frame) => {
  const { lineno, colno } = getCallLocation(node);

  ctx._emit('(lineno = ' + lineno +
    ', colno = ' + colno + ', ');

  ctx._emit('runtime.callWrap(');
  ctx._compileExpression(node.name, frame);

  const funcName = getNodeName(ctx, node.name);
  const displayName = funcName + '()';
  ctx._emit(', "' + funcName.replace(/"/g, '\\"') + '", "' + displayName.replace(/"/g, '\\"') + '", context, ');

  compileAggregate(ctx, node.args, frame, '[', '], ' + lineno + ', ' + colno + '))');
};
