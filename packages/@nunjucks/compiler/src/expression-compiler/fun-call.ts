import { BracketNotation, T, getNodeTypeName, isLiteral, isSymbol } from '@nunjucks/nodes';
import type { Node, CallNode, LookupNode, NodeLocation } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileAggregate } from './container.ts';
import { extractPropertyLocation } from '../location-utils.ts';
import { emitLocationGuard } from '../compiler-helpers.ts';

const bracketFlag = (n: Node): boolean | undefined => n[BracketNotation];

const buildSymbolSuffix = (val: Node, isBracket: boolean, prefix: string): string => {
  const suffix = isBracket ? `[${getNodeName(val)}]` : `.${getNodeName(val)}`;
  return prefix + suffix;
};

const buildLiteralSuffix = (val: Node, isBracket: boolean, prefix: string): string => {
  const suffix = isBracket ? `["${val.value}"]` : `.${val.value}`;
  return prefix + suffix;
};

const buildBracketAccessSuffix = (target: string, val: Node): string =>
  `${target}[${getNodeName(val)}]`;

const handleLookupVal = (node: LookupNode): string => {
  const target = getNodeName(node.target);
  const isBracket = bracketFlag(node) === true;
  const val = node.val;
  if (isSymbol(val)) {
    return buildSymbolSuffix(val, isBracket, target);
  }
  if (isLiteral(val) && typeof val.value === 'string') {
    return buildLiteralSuffix(val, isBracket, target);
  }
  return buildBracketAccessSuffix(target, val);
};

const handleOptionalChain = (node: LookupNode): string => {
  const target = getNodeName(node.target);
  const isBracket = bracketFlag(node) === true;
  const val = node.val;
  if (isSymbol(val)) {
    const suffix = isBracket ? `?.[${getNodeName(val)}]` : `?.${getNodeName(val)}`;
    return target + suffix;
  }
  if (isLiteral(val) && typeof val.value === 'string') {
    const suffix = isBracket ? `?.["${val.value}"]` : `?.${val.value}`;
    return target + suffix;
  }
  return `${target}?.[${getNodeName(val)}]`;
};

const getNodeName = (node: Node): string => {
  const typeName = getNodeTypeName(node);
  switch (typeName) {
    case T.SYMBOL:
      return node.value as string;
    case T.FUN_CALL:
      return `the return value of (${getNodeName((node as CallNode).name)})`;
    case T.LOOKUP_VAL:
      return handleLookupVal(node as LookupNode);
    case T.OPTIONAL_CHAIN:
      return handleOptionalChain(node as LookupNode);
    case T.LITERAL:
      return (node.value as { toString: () => string }).toString();
    default:
      return '--expression--';
  }
};

const getCallLocation = (node: CallNode): NodeLocation => {
  const name = node.name;
  const lookupName = name as LookupNode;
  const isQuotedBracketString = bracketFlag(name) === true &&
    isLiteral(lookupName.val) &&
    typeof lookupName.val?.value === 'string';
  // A quoted bracket access like obj['foo'] reports at the string, one past `[`.
  const extraColno = isQuotedBracketString ? 1 : 0;
  const loc = extractPropertyLocation(name, extraColno);
  return {
    lineno: loc.lineno ?? node.lineno,
    colno: loc.colno ?? node.colno
  };
};

export const compileFunCall = (ctx: Compiler, node: CallNode, frame: Frame): void => {
  const { lineno, colno } = getCallLocation(node);

  emitLocationGuard(ctx, lineno, colno);

  ctx.emit('runtime.callWrap(');
  ctx.compileExpression(node.name, frame);

  const funcName = getNodeName(node.name);
  const displayName = `${funcName}()`;
  ctx.emit(`, "${funcName.replace(/"/gu, '\\"')}", "${displayName.replace(/"/gu, '\\"')}", context, `);

  compileAggregate(ctx, node.args, frame, { startChar: '[', endChar: `], ${lineno}, ${colno}))` });
};
