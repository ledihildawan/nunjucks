import { BracketNotation, T, getNodeTypeName, isLiteral, isSymbol } from '@nunjucks/nodes';
import type { Node, CallNode, LookupNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import type { Compiler } from '../index.ts';
import { compileAggregate } from './container.ts';
import { extractPropertyLocation } from '../location-utils.ts';
import { emitLocationGuard } from '../codegen.ts';

const bracketFlag = (n: Node): boolean | undefined => n[BracketNotation];

const buildSymbolSuffix = (value: Node, isBracket: boolean, prefix: string): string => {
  const suffix = isBracket ? `[${getNodeName(value)}]` : `.${getNodeName(value)}`;
  return prefix + suffix;
};

const buildLiteralSuffix = (value: Node, isBracket: boolean, prefix: string): string => {
  const suffix = isBracket ? `["${value.value}"]` : `.${value.value}`;
  return prefix + suffix;
};

const buildBracketAccessSuffix = (target: string, value: Node): string =>
  `${target}[${getNodeName(value)}]`;

const handleLookupVal = (node: LookupNode): string => {
  const target = getNodeName(node.target);
  const isBracket = bracketFlag(node) === true;
  const value = node.val;
  if (isSymbol(value)) {
    return buildSymbolSuffix(value, isBracket, target);
  }
  if (isLiteral(value) && typeof value.value === 'string') {
    return buildLiteralSuffix(value, isBracket, target);
  }
  return buildBracketAccessSuffix(target, value);
};

const handleOptionalChain = (node: LookupNode): string => {
  const target = getNodeName(node.target);
  const isBracket = bracketFlag(node) === true;
  const value = node.val;
  if (isSymbol(value)) {
    const suffix = isBracket ? `?.[${getNodeName(value)}]` : `?.${getNodeName(value)}`;
    return target + suffix;
  }
  if (isLiteral(value) && typeof value.value === 'string') {
    const suffix = isBracket ? `?.["${value.value}"]` : `?.${value.value}`;
    return target + suffix;
  }
  return `${target}?.[${getNodeName(value)}]`;
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

const getCallLocation = (node: CallNode): { lineno: number; colno: number } => {
  const name = node.name;
  const lookupName = name as LookupNode;
  const isQuotedBracketString = bracketFlag(name) === true &&
    isLiteral(lookupName.val) &&
    typeof lookupName.val?.value === 'string';
  const extraColno = isQuotedBracketString ? 1 : 0;
  const loc = extractPropertyLocation(name, extraColno);
  return {
    lineno: loc.lineno ?? node.lineno,
    colno: loc.colno ?? node.colno
  };
};

export const compileFunCall = (compiler: Compiler, node: CallNode, frame: Frame): void => {
  const { lineno, colno } = getCallLocation(node);

  emitLocationGuard(compiler, lineno, colno);

  compiler.emit('runtime.callWrap(');
  compiler.compileExpression(node.name, frame);

  const funcName = getNodeName(node.name);
  const displayName = `${funcName}()`;
  compiler.emit(`, "${funcName.replace(/"/gu, '\\"')}", "${displayName.replace(/"/gu, '\\"')}", context, `);

  compileAggregate(compiler, node.args, frame, { startChar: '[', endChar: `], ${lineno}, ${colno}))` });
};
