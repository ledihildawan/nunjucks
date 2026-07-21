// FACTORY - Node creation (backward-compatible with mutable nodes)
// Import directly: import { node, literal, nodes } from '@nunjucks/nodes/factory'

import { T, type Node } from './types.ts';

const FIELDS_CACHE = new Map<string, readonly string[]>();

const createNode = (nodeType: string, lineno: number, colno: number, data: Record<string, unknown> = {}): Node => {
  const nodeObj: Node & { findAll?(...args: unknown[]): unknown[]; iterFields?(...args: unknown[]): void; addChild?(...args: unknown[]): void } = {
    type: nodeType, lineno, colno, ...data,
  } as Node;

  if (!FIELDS_CACHE.has(nodeType)) {
    FIELDS_CACHE.set(nodeType, Object.freeze(Object.keys(data)));
  }
  nodeObj.fields = FIELDS_CACHE.get(nodeType)!;

  nodeObj.findAll = function (this: Node, findType: string | ((n: Node) => boolean)): Node[] {
    const results: Node[] = [];
    const seen = new Set<Node>();
    const checkNode = (n: Node | null | undefined): void => {
      if (!n || seen.has(n)) return;
      seen.add(n);
      if (typeof findType === 'string') {
        if (n.type === findType) results.push(n);
      } else if (typeof findType === 'function') {
        if (findType(n)) results.push(n);
      }
      const children = (n as unknown as { children?: Node[] }).children;
      if (children && Array.isArray(children)) {
        children.forEach(checkNode);
      }
      const fields = (n as unknown as { fields?: readonly string[] }).fields;
      if (fields) {
        fields.forEach(field => {
          const val = (n as unknown as Record<string, unknown>)[field];
          if (val && typeof val === 'object') {
            if (Array.isArray(val)) {
              (val as Node[]).forEach(checkNode);
            } else {
              checkNode(val as Node);
            }
          }
        });
      }
    };
    checkNode(this);
    return results;
  };

  nodeObj.iterFields = function (this: Node, func: (val: unknown, field: string) => void): void {
    ((this as unknown as { fields: string[] }).fields).forEach(field => func((this as unknown as Record<string, unknown>)[field], field));
  };

  nodeObj.addChild = function (this: Node, child: Node): void {
    const children = (this as unknown as { children: Node[] }).children;
    if (children) children.push(child);
  };

  return nodeObj as Node;
};

const createNodeWithChildren = (nodeType: string, lineno: number, colno: number, children: Node[] = []): Node => {
  return createNode(nodeType, lineno, colno, { children: children || [] });
};

// Base creators
export const node = (lineno: number, colno: number): Node => createNode(T.NODE, lineno, colno);
export const value = (lineno: number, colno: number, val: unknown): Node => createNode(T.VALUE, lineno, colno, { value: val });
export const nodeList = (lineno: number, colno: number, children: Node[] = []): Node => createNodeWithChildren(T.NODE_LIST, lineno, colno, children);
export const output = (lineno: number, colno: number, children: Node[] = []): Node => createNodeWithChildren(T.OUTPUT, lineno, colno, children);
export const root = (lineno: number, colno: number, children: Node[] = []): Node => createNodeWithChildren(T.ROOT, lineno, colno, children);

// Expression nodes
export const literal = (lineno: number, colno: number, val: unknown): Node => createNode(T.LITERAL, lineno, colno, { value: val });
export const symbol = (lineno: number, colno: number, val: string): Node => createNode(T.SYMBOL, lineno, colno, { value: val });
export const templateData = (lineno: number, colno: number, val: string): Node => createNode(T.TEMPLATE_DATA, lineno, colno, { value: val });

// Function call nodes
export const funCall = (lineno: number, colno: number, name: Node | string, args: Node[] = []): Node =>
  createNode(T.FUN_CALL, lineno, colno, { name, args: args || [] });

export const pipe = (lineno: number, colno: number, name: Node | string, args: Node[] = []): Node =>
  createNode(T.PIPE, lineno, colno, { name, args: args || [] });

export const pipeAsync = (lineno: number, colno: number, name: Node | string, args: Node[] = [], symbol_?: Node): Node =>
  createNode(T.PIPE_ASYNC, lineno, colno, { name, args: args || [], symbol: symbol_ });

// Lookup nodes
export const lookupVal = (lineno: number, colno: number, target: Node, val: Node): Node =>
  createNode(T.LOOKUP_VAL, lineno, colno, { target, val });

export const slice = (lineno: number, colno: number, start: Node | null, stop: Node | null, step: Node | null): Node =>
  createNode(T.SLICE, lineno, colno, { start, stop, step });

export const optionalChain = (lineno: number, colno: number, target: Node, val: Node): Node =>
  createNode(T.OPTIONAL_CHAIN, lineno, colno, { target, val });

export const optionalCall = (lineno: number, colno: number, name: Node | string, args: Node[] = []): Node =>
  createNode(T.OPTIONAL_CALL, lineno, colno, { name, args: args || [] });

// Binary operations
export const add = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.ADD, lineno, colno, { left, right, operator: '+' });
export const sub = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.SUB, lineno, colno, { left, right, operator: '-' });
export const mul = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.MUL, lineno, colno, { left, right, operator: '*' });
export const div = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.DIV, lineno, colno, { left, right, operator: '/' });
export const floorDiv = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.FLOOR_DIV, lineno, colno, { left, right, operator: '//' });
export const mod = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.MOD, lineno, colno, { left, right, operator: '%' });
export const pow = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.POW, lineno, colno, { left, right, operator: '**' });
export const concat = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.CONCAT, lineno, colno, { left, right });

export const binOp = (type: string) => (lineno: number, colno: number, left: Node, right: Node, operator: string): Node =>
  createNode(type, lineno, colno, { left, right, operator });

export const unaryOp = (type: string) => (lineno: number, colno: number, target: Node, operator: string): Node =>
  createNode(type, lineno, colno, { target, operator });

// Unary operations
export const not = (lineno: number, colno: number, target: Node): Node => createNode(T.NOT, lineno, colno, { target, operator: 'not' });
export const neg = (lineno: number, colno: number, target: Node): Node => createNode(T.NEG, lineno, colno, { target, operator: '-' });
export const pos = (lineno: number, colno: number, target: Node): Node => createNode(T.POS, lineno, colno, { target, operator: '+' });

// Logical operations
export const and = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.AND, lineno, colno, { left, right });
export const or = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.OR, lineno, colno, { left, right });
export const nullishCoalesce = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.NULLISH_COALESCE, lineno, colno, { left, right });

// Comparison operations
export const compare = (lineno: number, colno: number, expr: Node, ops: Node[] = []): Node =>
  createNode(T.COMPARE, lineno, colno, { expr, ops: ops || [] });

export const compareOperand = (lineno: number, colno: number, expr: Node, operator: string): Node =>
  createNode(T.COMPARE_OPERAND, lineno, colno, { expr, operator });

export const bitwiseOr = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.BITWISE_OR, lineno, colno, { left, right });
export const bitwiseAnd = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.BITWISE_AND, lineno, colno, { left, right });
export const bitwiseXor = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.BITWISE_XOR, lineno, colno, { left, right });
export const bitwiseLShift = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.BITWISE_LSHIFT, lineno, colno, { left, right });
export const bitwiseRShift = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.BITWISE_RSHIFT, lineno, colno, { left, right });
export const bitwiseNot = (lineno: number, colno: number, target: Node): Node => createNode(T.BITWISE_NOT, lineno, colno, { target });

export const increment = (lineno: number, colno: number, target: Node, isPostfix: boolean): Node => createNode(T.INCREMENT, lineno, colno, { target, isPostfix });
export const decrement = (lineno: number, colno: number, target: Node, isPostfix: boolean): Node => createNode(T.DECREMENT, lineno, colno, { target, isPostfix });

// Destructuring pattern nodes
export const arrayPattern = (lineno: number, colno: number, children: Node[] = []): Node => createNodeWithChildren(T.ARRAY_PATTERN, lineno, colno, children);
export const objectPattern = (lineno: number, colno: number, children: Node[] = []): Node => createNodeWithChildren(T.OBJECT_PATTERN, lineno, colno, children);
export const patternProperty = (lineno: number, colno: number, key: Node, val: Node): Node => createNode(T.PATTERN_PROPERTY, lineno, colno, { key, value: val });
export const restPattern = (lineno: number, colno: number, target: Node): Node => createNode(T.REST_PATTERN, lineno, colno, { target });
export const assignmentPattern = (lineno: number, colno: number, target: Node, defaultVal: Node): Node => createNode(T.ASSIGNMENT_PATTERN, lineno, colno, { target, value: defaultVal });
export const hole = (lineno: number, colno: number): Node => createNode(T.HOLE, lineno, colno, {});

// Type checks
export const is = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.IS, lineno, colno, { left, right });
export const in_ = (lineno: number, colno: number, left: Node, right: Node): Node => createNode(T.IN, lineno, colno, { left, right });

// Statement nodes
export const block = (...args: unknown[]): Node => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, name, body] = args as [number, number, string?, Node?];
    return createNode(T.BLOCK, lineno, colno, { name, body });
  }
  const [lineno, colno] = args as [number, number];
  return createNode(T.BLOCK, lineno, colno, {});
};

export const if_ = (...args: unknown[]): Node => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, cond, body, else__ = null] = args as [number, number, Node?, Node?, Node?];
    return createNode(T.IF, lineno, colno, { cond, body, else_: else__ });
  }
  const [lineno, colno] = args as [number, number];
  return createNode(T.IF, lineno, colno, { else_: null });
};

export const inlineIf = (...args: unknown[]): Node => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, cond, body, else__ = null] = args as [number, number, Node?, Node?, Node?];
    return createNode(T.INLINE_IF, lineno, colno, { cond, body, else_: else__ });
  }
  const [lineno, colno] = args as [number, number];
  return createNode(T.INLINE_IF, lineno, colno, { else_: null });
};

export const for_ = (...args: unknown[]): Node => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, arr, name, body, else__ = null] = args as [number, number, Node?, Node?, Node?, Node?];
    return createNode(T.FOR, lineno, colno, { arr, name, body, else_: else__ });
  }
  const [lineno, colno] = args as [number, number];
  return createNode(T.FOR, lineno, colno, { else_: null });
};

export const macro = (lineno: number, colno: number, name: string, args: Node[], body?: Node): Node =>
  createNode(T.MACRO, lineno, colno, { name, args: args || [], body });

export const caller = (lineno: number, colno: number, args: Node[], body?: Node): Node =>
  createNode(T.CALLER, lineno, colno, { args: args || [], body });

export const call = (lineno: number, colno: number, name: string, args: Node[], body?: Node): Node =>
  createNode(T.CALL, lineno, colno, { name, args: args || [], body });

export const import_ = (lineno: number, colno: number, template: Node | string, target: string, withContext = false): Node =>
  createNode(T.IMPORT, lineno, colno, { template, target, withContext });

export const fromImport = (lineno: number, colno: number, template: Node | string, names?: Node, withContext = false): Node =>
  createNode(T.FROM_IMPORT, lineno, colno, { template, names: names || nodeList(0, 0), withContext });

export const set = (...args: unknown[]): Node => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, targets = [], val, operator = null] = args as [number, number, Node[]?, Node?, string?];
    return createNode(T.SET, lineno, colno, { targets: targets || [], value: val, operator });
  }
  const [lineno, colno] = args as [number, number];
  return createNode(T.SET, lineno, colno, { targets: [] });
};

export const capture = (lineno: number, colno: number, body: Node): Node =>
  createNode(T.CAPTURE, lineno, colno, { body });

export const tryCatch = (lineno: number, colno: number, body: Node, catchBody: Node | null = null, errVar: string | null = null): Node =>
  createNode(T.TRY_CATCH, lineno, colno, { body, catch: catchBody, errVar });

export const do_ = (lineno: number, colno: number, expr: Node): Node =>
  createNode(T.DO, lineno, colno, { expr });

export const with_ = (lineno: number, colno: number, assignments: Node[] = [], body: Node | null = null): Node =>
  createNode(T.WITH, lineno, colno, { assignments, body });

export const switch_ = (lineno: number, colno: number, expr: Node, cases: Node[] = [], default_: Node | null = null): Node =>
  createNode(T.SWITCH, lineno, colno, { expr, cases: cases || [], default: default_ });

export const case_ = (lineno: number, colno: number, cond: Node, body: Node): Node =>
  createNode(T.CASE, lineno, colno, { cond, body });

// Template reference nodes
export const templateRef = (lineno: number, colno: number, template: string): Node =>
  createNode(T.TEMPLATE_REF, lineno, colno, { template });

export const extends_ = (...args: unknown[]): Node => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, template] = args as [number, number, Node?];
    return createNode(T.EXTENDS, lineno, colno, { template });
  }
  const [lineno, colno] = args as [number, number];
  return createNode(T.EXTENDS, lineno, colno, {});
};

export const include = (...args: unknown[]): Node => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, template, ignoreMissing = null] = args as [number, number, Node?, boolean?];
    return createNode(T.INCLUDE, lineno, colno, { template, ignoreMissing });
  }
  const [lineno, colno] = args as [number, number];
  return createNode(T.INCLUDE, lineno, colno, { ignoreMissing: null });
};

export const super_ = (lineno: number, colno: number, blockName: string, sym: Node | null = null): Node =>
  createNode(T.SUPER, lineno, colno, { blockName, symbol: sym });

// Aggregate nodes
export const group = (lineno: number, colno: number, children: Node[] = []): Node => createNodeWithChildren(T.GROUP, lineno, colno, children);
export const array = (lineno: number, colno: number, children: Node[] = []): Node => createNodeWithChildren(T.ARRAY, lineno, colno, children);
export const dict = (lineno: number, colno: number, children: Node[] = []): Node => createNodeWithChildren(T.DICT, lineno, colno, children);
export const pair = (lineno: number, colno: number, key: Node, val: Node): Node => createNode(T.PAIR, lineno, colno, { key, value: val });

export const spread = (lineno: number, colno: number, argument: Node): Node => createNode(T.SPREAD, lineno, colno, { argument });
export const walrus = (lineno: number, colno: number, target: Node, val: Node): Node => createNode(T.WALRUS, lineno, colno, { target, value: val });

export const variableDeclaration = (lineno: number, colno: number, targets: Node[], value: Node): Node => createNode(T.VARIABLE_DECLARATION, lineno, colno, { targets: targets || [], value });
export const variableAssignment = (lineno: number, colno: number, targets: Node[], value: Node): Node => createNode(T.VARIABLE_ASSIGNMENT, lineno, colno, { targets: targets || [], value });
export const compoundAssignment = (lineno: number, colno: number, targets: Node[], operator: string, value: Node): Node => createNode(T.COMPOUND_ASSIGNMENT, lineno, colno, { targets: targets || [], operator, value });
export const defineBlock = (lineno: number, colno: number, name: string, body: Node, args: Node[] = []): Node => createNode(T.DEFINE_BLOCK, lineno, colno, { name, body, args });

export const templateLiteral = (lineno: number, colno: number, quasis: unknown[]): Node => createNode(T.TEMPLATE_LITERAL, lineno, colno, { quasis: quasis || [] });

export const keywordArgs = (lineno: number, colno: number, children: Node[] = []): Node => createNodeWithChildren(T.KEYWORD_ARGS, lineno, colno, children);

// Extension nodes - support both (lineno, colno, ext, prop, args, contentArgs) and (ext, prop, args, contentArgs)
export const callExtension = (...args: unknown[]): Node => {
  let lineno: number, colno: number, ext: unknown, prop: string;
  let argsArr: Node | undefined, contentArgsArr: Node[] | undefined;

  if (typeof args[0] === 'number') {
    [lineno, colno, ext, prop, argsArr, contentArgsArr] = args as [number, number, unknown, string, Node?, Node[]?];
  } else {
    [ext, prop, argsArr, contentArgsArr] = args as [unknown, string, Node?, Node[]?];
    lineno = 0; colno = 0;
  }

  const extObj = ext as { __name?: string; autoescape?: boolean };
  return createNode(T.CALL_EXTENSION, lineno, colno, {
    extName: extObj?.__name || (ext as string),
    prop,
    args: argsArr ?? nodeList(0, 0),
    contentArgs: contentArgsArr ?? [],
    autoescape: extObj?.autoescape ?? true,
  });
};

export const callExtensionAsync = (...args: unknown[]): Node => {
  let lineno: number, colno: number, ext: unknown, prop: string;
  let argsArr: Node | undefined, contentArgsArr: Node[] | undefined;

  if (typeof args[0] === 'number') {
    [lineno, colno, ext, prop, argsArr, contentArgsArr] = args as [number, number, unknown, string, Node?, Node[]?];
  } else {
    [ext, prop, argsArr, contentArgsArr] = args as [unknown, string, Node?, Node[]?];
    lineno = 0; colno = 0;
  }

  const extObj = ext as { __name?: string; autoescape?: boolean };
  return createNode(T.CALL_EXTENSION_ASYNC, lineno, colno, {
    extName: extObj?.__name || (ext as string),
    prop,
    args: argsArr ?? nodeList(0, 0),
    contentArgs: contentArgsArr ?? [],
    autoescape: extObj?.autoescape ?? true,
  });
};

// Aliases for backward compatibility naming
export const Filter = pipe;
export const FilterAsync = pipeAsync;
export const LiteralNode = literal;

// ============================================
// GROUPED NAMESPACE (backward-compat for parser/compiler)
// ============================================
import { isNode, isValue, isLiteral, isSymbol, isNodeList, isOutput, isRoot,
  isFunCall, isPipe, isFilter, isBlock, isExtends, isInclude, isMacro, isSet,
  isIf, isFor, isCompare, isLookupVal, isCallExtension, isCallExtensionAsync,
  isDict, isArray, isPair, isConcat, isAdd, isBinOp, isUnaryOp, isKeywordArgs,
  isTemplateData, isSlice, isPipeAsync, isOptionalChain, isOptionalCall,
  isImport, isFromImport, isSwitch, isCase, isCapture, isTryCatch, isDo, isWith,
  isCaller, isCall, isSuper, isTemplateRef, isInlineIf, isOr, isAnd, isNot,
  isNullishCoalesce, isCompareOperand, isIn, isIs, isSpread, isWalrus,
  isTemplateLiteral, isGroup, isSub, isMul, isDiv, isFloorDiv, isMod, isPow,
  isNeg, isPos, isArrayPattern, isObjectPattern, isPatternProperty, isRestPattern,
  isAssignmentPattern, isHole, isPattern,
  isVariableDeclaration, isVariableAssignment, isCompoundAssignment, isDefineBlock,
  isBitwiseOr, isBitwiseAnd, isBitwiseXor, isBitwiseLShift, isBitwiseRShift, isBitwiseNot,
  isIncrement, isDecrement } from './guards.ts';
import { getType as getNodeTypeName, getFields_ as getNodeFields, addChild as addChildHelper,
  findAll as findAllNodes, walk as walkNodes, findFirst, count as countNodes } from './traverse.ts';

export const nodes = Object.freeze({
  NODE_TYPES: T,

  // Base creators
  node, value, nodeList, output, root,
  literal, symbol, templateData,
  funCall, pipe, pipeAsync,
  lookupVal, slice, optionalChain, optionalCall,
  add, sub, mul, div, floorDiv, mod, pow, concat, binOp,
  unaryOp, not, neg, pos,
  and, or, nullishCoalesce,
  compare, compareOperand,
  bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift, bitwiseNot,
  increment, decrement,
  arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern, hole,
  is, in: in_,
  block, if: if_, inlineIf, for: for_, macro, caller, call, import: import_, fromImport, set,
  capture, tryCatch, do: do_, with: with_, switch: switch_, case: case_,
  templateRef, extends: extends_, include, super: super_,
  group, array, dict, pair, spread, walrus, templateLiteral, keywordArgs,
  variableDeclaration, variableAssignment, compoundAssignment, defineBlock,
  callExtension, callExtensionAsync,
  Filter, FilterAsync, LiteralNode,

  // Type guards
  isNode, isValue, isLiteral, isSymbol, isNodeList, isOutput, isRoot,
  isFunCall, isPipe, isFilter, isBlock, isExtends, isInclude, isMacro, isSet,
  isIf, isFor, isCompare, isLookupVal, isCallExtension, isCallExtensionAsync,
  isDict, isArray, isPair, isConcat, isAdd, isBinOp, isUnaryOp, isKeywordArgs,
  isTemplateData, isSlice, isPipeAsync, isOptionalChain, isOptionalCall,
  isImport, isFromImport, isSwitch, isCase, isCapture, isTryCatch, isDo, isWith,
  isCaller, isCall, isSuper, isTemplateRef, isInlineIf, isOr, isAnd, isNot,
  isNullishCoalesce, isCompareOperand, isIn, isIs, isSpread, isWalrus,
  isTemplateLiteral, isGroup, isSub, isMul, isDiv, isFloorDiv, isMod, isPow,
  isNeg, isPos, isArrayPattern, isObjectPattern, isPatternProperty, isRestPattern,
  isAssignmentPattern, isHole, isPattern,
  isVariableDeclaration, isVariableAssignment, isCompoundAssignment, isDefineBlock,
  isBitwiseOr, isBitwiseAnd, isBitwiseXor, isBitwiseLShift, isBitwiseRShift, isBitwiseNot,
  isIncrement, isDecrement,

  // Helpers
  getNodeTypeName,
  getNodeFields,
  addChild: addChildHelper,
  findAll: findAllNodes,
  walk: walkNodes,
  findFirst,
  count: countNodes,

  // Generic creator
  createNode,
});

// Generic creator (for advanced usage)
export { createNode };
