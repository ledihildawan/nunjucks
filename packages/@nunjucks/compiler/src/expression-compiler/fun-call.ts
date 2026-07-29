import { BracketNotation, getNodeTypeName, isLiteral, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileAggregate } from './container.ts';
import { extractPropertyLocation } from '../location-utils.ts';

const bracketFlag = (n: Node): boolean | undefined => n[BracketNotation];

const buildSymbolSuffix = (val: Node, isBracket: boolean, prefix: string): string => {
  const suffix = isBracket ? `[${getNodeName(undefined as unknown as Compiler, val)}]` : `.${getNodeName(undefined as unknown as Compiler, val)}`;
  return prefix + suffix;
};

const buildLiteralSuffix = (val: Node, isBracket: boolean, prefix: string): string => {
  const suffix = isBracket ? `["${val.value}"]` : `.${val.value}`;
  return prefix + suffix;
};

const buildBracketAccessSuffix = (target: string, val: Node): string =>
  `${target}[${getNodeName(undefined as unknown as Compiler, val)}]`;

const handleLookupVal = (_ctx: Compiler, node: Node): string => {
  const target = getNodeName(_ctx, node.target as Node);
  const isBracket = bracketFlag(node) === true;
  const val = node.val as Node;
  if (isSymbol(val)) {
    return buildSymbolSuffix(val, isBracket, target);
  }
  if (isLiteral(val) && typeof val.value === 'string') {
    return buildLiteralSuffix(val, isBracket, target);
  }
  return buildBracketAccessSuffix(target, val);
};

const handleOptionalChain = (_ctx: Compiler, node: Node): string => {
  const target = getNodeName(_ctx, node.target as Node);
  const isBracket = bracketFlag(node) === true;
  const val = node.val as Node;
  if (isSymbol(val)) {
    const suffix = isBracket ? `?.[${getNodeName(_ctx, val)}]` : `?.${getNodeName(_ctx, val)}`;
    return target + suffix;
  }
  if (isLiteral(val) && typeof val.value === 'string') {
    const suffix = isBracket ? `?.["${val.value}"]` : `?.${val.value}`;
    return target + suffix;
  }
  return `${target}?.[${getNodeName(_ctx, val)}]`;
};

const getNodeName = (_ctx: Compiler, node: Node, _isBracketCall = false): string => {
  const typeName = getNodeTypeName(node);
  switch (typeName) {
    case 'symbol':
      return node.value as string;
    case 'funCall':
      return `the return value of (${getNodeName(_ctx, node.name as Node)})`;
    case 'lookupVal':
      return handleLookupVal(_ctx, node);
    case 'optionalChain':
      return handleOptionalChain(_ctx, node);
    case 'literal':
      return (node.value as { toString: () => string }).toString();
    default:
      return '--expression--';
  }
};

const getCallLocation = (node: Node): { lineno: number; colno: number } => {
  const name = node.name as Node;
  const isQuotedBracketString = bracketFlag(name) === true &&
    isLiteral(name?.val as Node) &&
    typeof (name?.val as { value?: unknown })?.value === 'string';
  // A quoted bracket access like obj['foo'] reports at the string, one past `[`.
  const extraColno = isQuotedBracketString ? 1 : 0;
  const loc = extractPropertyLocation(name, extraColno);
  return {
    lineno: loc.lineno ?? node.lineno,
    colno: loc.colno ?? node.colno
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

  compileAggregate(ctx, node.args as Node, frame, { startChar: '[', endChar: `], ${lineno}, ${colno}))` });
};
