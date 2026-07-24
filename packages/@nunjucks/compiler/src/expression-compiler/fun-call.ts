import { BracketNotation, getNodeTypeName, isLiteral, isLookupVal, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileAggregate } from './container.ts';

const bracketFlag = (n: Node): unknown => (n as unknown as Record<symbol, unknown>)[BracketNotation];

const getNodeName = (_ctx: Compiler, node: Node, _isBracketCall = false): string => {
  const typeName = getNodeTypeName(node);
  switch (typeName) {
    case 'symbol':
      return node.value as string;
    case 'funCall':
      return `the return value of (${getNodeName(_ctx, node.name as Node)})`;
    case 'lookupVal': {
      const target = getNodeName(_ctx, node.target as Node);
      const isBracket = bracketFlag(node) === true;
      const val = node.val as Node;
      if (isSymbol(val)) {
        let suffix: string;
        if (isBracket) {
          suffix = `[${getNodeName(_ctx, val)}]`;
        } else {
          suffix = `.${getNodeName(_ctx, val)}`;
        }
        return target + suffix;
      }
      if (isLiteral(val) && typeof val.value === 'string') {
        let suffix: string;
        if (isBracket) {
          suffix = `["${val.value}"]`;
        } else {
          suffix = `.${val.value}`;
        }
        return target + suffix;
      }
      return `${target}[${getNodeName(_ctx, val)}]`;
    }
    case 'optionalChain': {
      const target = getNodeName(_ctx, node.target as Node);
      const isBracket = bracketFlag(node) === true;
      const val = node.val as Node;
      if (isSymbol(val)) {
        let suffix: string;
        if (isBracket) {
          suffix = `?.[${getNodeName(_ctx, val)}]`;
        } else {
          suffix = `?.${getNodeName(_ctx, val)}`;
        }
        return target + suffix;
      }
      if (isLiteral(val) && typeof val.value === 'string') {
        let suffix: string;
        if (isBracket) {
          suffix = `?.["${val.value}"]`;
        } else {
          suffix = `?.${val.value}`;
        }
        return target + suffix;
      }
      return `${target}?.[${getNodeName(_ctx, val)}]`;
    }
    case 'literal':
      return (node.value as { toString: () => string }).toString();
    default:
      return '--expression--';
  }
};

const getCallLocation = (node: Node): { lineno: number; colno: number } => {
  const name = node.name as Node;
  if (isLookupVal(name) && (name.val as Node)?.lineno !== null && (name.val as Node)?.colno !== null) {
    const nameVal = name.val as Node;
    const isQuotedBracketString = bracketFlag(name) === true &&
      isLiteral(nameVal) &&
      typeof nameVal.value === 'string';
    let extraColno: number;
    if (isQuotedBracketString) {
      extraColno = 1;
    } else {
      extraColno = 0;
    }
    return {
      lineno: nameVal.lineno,
      colno: nameVal.colno + extraColno
    };
  }

  return {
    lineno: name?.lineno ?? node.lineno,
    colno: name?.colno ?? node.colno
  };
};

export const compileFunCall = (ctx: Compiler, node: Node, frame: Frame): void => {
  const { lineno, colno } = getCallLocation(node);

  ctx.emit('(lineno = ' + lineno +
    ', colno = ' + colno + ', ');

  ctx.emit('runtime.callWrap(');
  ctx.compileExpression(node.name as Node, frame);

  const funcName = getNodeName(ctx, node.name as Node);
  const displayName = `${funcName}()`;
  ctx.emit(`, "${funcName.replace(/"/gu, '\\"')}", "${displayName.replace(/"/gu, '\\"')}", context, `);

  compileAggregate(ctx, node.args as Node, frame, '[', `], ${lineno}, ${colno}))`);
};
