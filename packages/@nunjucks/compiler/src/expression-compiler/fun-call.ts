import type { CallNode, LiteralNode, LookupNode, Node } from '@nunjucks/nodes';
import { BracketNotation, isLiteral, isSymbol, T } from '@nunjucks/nodes';
import { emitLocationGuard } from '../codegen.ts';
import type { Compiler } from '../index.ts';
import { extractPropertyLocation } from '../location-utils.ts';
import type { CompileNodeInput } from '../node-dispatch.ts';
import { compileAggregate } from './container.ts';

const bracketFlag = (node: Node): boolean | undefined => node[BracketNotation];

interface BuildSuffixInput {
  value: Node;
  isBracket: boolean;
  prefix: string;
}

const buildSymbolSuffix = ({ value, isBracket, prefix }: BuildSuffixInput): string => {
  const suffix = isBracket ? `[${getNodeName(value)}]` : `.${getNodeName(value)}`;
  return prefix + suffix;
};

const buildLiteralSuffix = ({ value, isBracket, prefix }: BuildSuffixInput): string => {
  const literalValue = (value as LiteralNode).value;
  const suffix = isBracket ? `["${literalValue}"]` : `.${literalValue}`;
  return prefix + suffix;
};

const buildBracketAccessSuffix = (target: string, value: Node): string =>
  `${target}[${getNodeName(value)}]`;

const handleLookupVal = (node: LookupNode): string => {
  const target = getNodeName(node.target);
  const isBracket = bracketFlag(node) === true;
  const value = node.val;
  if (isSymbol(value)) {
    return buildSymbolSuffix({ value, isBracket, prefix: target });
  }
  if (isLiteral(value) && typeof value.value === 'string') {
    return buildLiteralSuffix({ value, isBracket, prefix: target });
  }
  return buildBracketAccessSuffix(target, value);
};

const handleOptionalChain = (node: LookupNode): string => {
  const target = getNodeName(node.target);
  const isBracket = bracketFlag(node) === true;
  const value = node.val;
  if (isSymbol(value)) {
    const suffix = isBracket ? `?.[${getNodeName(value)}]` : `?.${getNodeName(value)}`;
    return `${target}${suffix}`;
  }
  if (isLiteral(value) && typeof value.value === 'string') {
    const literalValue = (value as LiteralNode).value;
    const suffix = isBracket ? `?.["${literalValue}"]` : `?.${literalValue}`;
    return `${target}${suffix}`;
  }
  return `${target}?.[${getNodeName(value)}]`;
};

const getNodeName = (node: Node): string => {
  switch (node.type) {
    case T.SYMBOL:
      return node.value;
    case T.FUN_CALL: {
      return `the return value of (${getNodeName(node.name)})`;
    }
    case T.LOOKUP_VAL:
      return handleLookupVal(node);
    case T.OPTIONAL_CHAIN:
      return handleOptionalChain(node);
    case T.LITERAL:
      return String(node.value);
    default:
      return '--expression--';
  }
};

const getCallLocation = (node: CallNode): { lineno: number; colno: number } => {
  const name = node.name;
  // WHY: `name` is the CallNode's `.name` (a LookupNode for `obj["key"]()`). The quoted-bracket-string heuristic checks whether the inner `.val` is a string-literal — for `user["status"]()` that gives `true`, for `user[var]()` gives `false`. The `as LookupNode` cast is required because `name` is a `Node` union, but the `.val` field is `LookupNode`-specific.
  const lookupName = name as LookupNode;
  const isQuotedBracketString =
    bracketFlag(name) === true &&
    isLiteral(lookupName.val) &&
    typeof lookupName.val.value === 'string';
  const extraColno = isQuotedBracketString ? 1 : 0;
  const propLoc = extractPropertyLocation(name, extraColno);
  return {
    lineno: propLoc.lineno ?? node.lineno,
    colno: propLoc.colno ?? node.colno,
  };
};

/**
 * Compiles a function call to `runtime.callWrap(fn, name, { displayName,
 * context, args, lineno, colno })`, deriving the call site's location from
 * the callee's property position.
 */
export const compileFunCall = (
  compiler: Compiler,
  { node, frame }: CompileNodeInput<CallNode>
): void => {
  const { lineno, colno } = getCallLocation(node);

  emitLocationGuard(compiler, lineno, colno);

  compiler.emit('runtime.callWrap(');
  compiler.compileExpression(node.name, frame);

  const funcName = getNodeName(node.name);
  const displayName = `${funcName}()`;
  compiler.emit(
    `, ${JSON.stringify(funcName)}, { displayName: ${JSON.stringify(displayName)}, context, args: `
  );

  compileAggregate(compiler, {
    node: node.args,
    frame,
    options: {
      startChar: '[',
      endChar: `], lineno: ${lineno}, colno: ${colno} }))`,
    },
  });
};
