import { BracketNotation, getNodeTypeName, isLiteral, isLookupVal, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileAggregate } from './container.ts';

const bracketFlag = (n: Node): unknown => (n as unknown as Record<symbol, unknown>)[BracketNotation];

const getNodeName = (ctx: Compiler, node: Node, isBracketCall: boolean = false): string => {
  const typeName = getNodeTypeName(node);
  switch (typeName) {
    case 'symbol':
      return node.value as string;
    case 'funCall':
      return 'the return value of (' + getNodeName(ctx, node.name as Node) + ')';
    case 'lookupVal': {
      const target = getNodeName(ctx, node.target as Node);
      const isBracket = bracketFlag(node) === true;
      const val = node.val as Node;
      if (isSymbol(val)) {
        return target + (isBracket ? '[' + getNodeName(ctx, val) + ']' : '.' + getNodeName(ctx, val));
      }
      if (isLiteral(val) && typeof val.value === 'string') {
        return target + (isBracket ? '["' + val.value + '"]' : '.' + val.value);
      }
      return target + '[' + getNodeName(ctx, val) + ']';
    }
    case 'optionalChain': {
      const target = getNodeName(ctx, node.target as Node);
      const isBracket = bracketFlag(node) === true;
      const val = node.val as Node;
      if (isSymbol(val)) {
        return target + (isBracket ? '?.[' + getNodeName(ctx, val) + ']' : '?.' + getNodeName(ctx, val));
      }
      if (isLiteral(val) && typeof val.value === 'string') {
        return target + (isBracket ? '?.["' + val.value + '"]' : '?.' + val.value);
      }
      return target + '?.[' + getNodeName(ctx, val) + ']';
    }
    case 'literal':
      return (node.value as { toString(): string }).toString();
    default:
      return '--expression--';
  }
};

const getCallLocation = (node: Node): { lineno: number; colno: number } => {
  const name = node.name as Node;
  if (isLookupVal(name) && (name.val as Node)?.lineno != null && (name.val as Node)?.colno != null) {
    const nameVal = name.val as Node;
    const isQuotedBracketString = bracketFlag(name) === true &&
      isLiteral(nameVal) &&
      typeof nameVal.value === 'string';
    return {
      lineno: nameVal.lineno,
      colno: nameVal.colno + (isQuotedBracketString ? 1 : 0)
    };
  }

  return {
    lineno: name?.lineno ?? node.lineno,
    colno: name?.colno ?? node.colno
  };
};

export const compileFunCall = (ctx: Compiler, node: Node, frame: Frame): void => {
  const { lineno, colno } = getCallLocation(node);

  ctx._emit('(lineno = ' + lineno +
    ', colno = ' + colno + ', ');

  ctx._emit('runtime.callWrap(');
  ctx._compileExpression(node.name as Node, frame);

  const funcName = getNodeName(ctx, node.name as Node);
  const displayName = funcName + '()';
  ctx._emit(', "' + funcName.replace(/"/g, '\\"') + '", "' + displayName.replace(/"/g, '\\"') + '", context, ');

  compileAggregate(ctx, node.args as Node, frame, '[', '], ' + lineno + ', ' + colno + '))');
};
