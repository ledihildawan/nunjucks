// FACTORY - Node creation (type-safe; expression creators return precise variants)
import { T, type Node, type NodeType, type NodeOf, FIELDS } from './types/index.ts';
import type {
  ValueNode, ChildrenNode, BinaryOpNode, BinaryNode, UnaryOpNode, UnaryNode,
  IncDecNode, CallNode, LookupNode, SliceNode, CompareNode,
  CompareOperandNode, PairNode, SpreadNode, WalrusNode, RestPatternNode,
  AssignmentPatternNode, HoleNode, VariableDeclNode, CompoundAssignNode,
  TemplateLiteralNode, MacroArgument, CallExtensionNode,
} from './types/index.ts';

const createNode = <K extends NodeType>(nodeType: K, lineno: number, colno: number, data: Record<string, unknown> = {}): NodeOf<K> => ({
    type: nodeType, lineno, colno, fields: FIELDS[nodeType], ...data,
  } as unknown as NodeOf<K>);

const createNodeWithChildren = <K extends NodeType>(nodeType: K, lineno: number, colno: number, children: readonly Node[] = []): NodeOf<K> =>
  createNode(nodeType, lineno, colno, { children: [...children] });

// Base creators
const node = (lineno: number, colno: number): Node => createNode(T.NODE, lineno, colno);
const value = (lineno: number, colno: number, val: unknown): ValueNode => createNode(T.VALUE, lineno, colno, { value: val });
const nodeList = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.NODE_LIST, lineno, colno, children);
const output = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.OUTPUT, lineno, colno, children);
const root = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.ROOT, lineno, colno, children);

// Expression nodes
const literal = (lineno: number, colno: number, val: unknown): ValueNode => createNode(T.LITERAL, lineno, colno, { value: val });
const symbol = (lineno: number, colno: number, val: string): ValueNode => createNode(T.SYMBOL, lineno, colno, { value: val });
const templateData = (lineno: number, colno: number, val: string): ValueNode => createNode(T.TEMPLATE_DATA, lineno, colno, { value: val });

// Function call nodes
const funCall = (lineno: number, colno: number, name: Node | string, args: Node[] = []): CallNode =>
  createNode(T.FUN_CALL, lineno, colno, { name, args });

const pipe = (lineno: number, colno: number, name: Node | string, args: Node[] = []): CallNode =>
  createNode(T.PIPE, lineno, colno, { name, args });

// Lookup nodes
const lookupVal = (lineno: number, colno: number, target: Node, val: Node): LookupNode =>
  createNode(T.LOOKUP_VAL, lineno, colno, { target, val });

// CONVENTION: every factory takes (lineno, colno) first. Factories with more
// than two remaining fields take them as one named object, so call sites read
// as field names rather than as an argument order to memorise.

interface SliceFields {
  start: Node | null;
  stop: Node | null;
  step: Node | null;
}

const slice = (lineno: number, colno: number, fields: SliceFields): SliceNode =>
  createNode(T.SLICE, lineno, colno, { ...fields });

const optionalChain = (lineno: number, colno: number, target: Node, val: Node): LookupNode =>
  createNode(T.OPTIONAL_CHAIN, lineno, colno, { target, val });

const optionalCall = (lineno: number, colno: number, name: Node | string, args: Node[] = []): CallNode =>
  createNode(T.OPTIONAL_CALL, lineno, colno, { name, args });

// Binary operations
const add = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.ADD, lineno, colno, { left, right, operator: '+' });
const sub = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.SUB, lineno, colno, { left, right, operator: '-' });
const mul = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.MUL, lineno, colno, { left, right, operator: '*' });
const div = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.DIV, lineno, colno, { left, right, operator: '/' });
const floorDiv = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.FLOOR_DIV, lineno, colno, { left, right, operator: '//' });
const mod = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.MOD, lineno, colno, { left, right, operator: '%' });
const pow = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.POW, lineno, colno, { left, right, operator: '**' });
const concat = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.CONCAT, lineno, colno, { left, right });

interface BinaryOpFields {
  left: Node;
  right: Node;
  operator: string;
}

const binOp = (type: NodeType) => (lineno: number, colno: number, fields: BinaryOpFields): Node =>
  createNode(type, lineno, colno, { ...fields });

const unaryOp = (type: NodeType) => (lineno: number, colno: number, target: Node, operator: string): Node =>
  createNode(type, lineno, colno, { target, operator });

// Unary operations
const not = (lineno: number, colno: number, target: Node): UnaryOpNode => createNode(T.NOT, lineno, colno, { target, operator: 'not' });
const neg = (lineno: number, colno: number, target: Node): UnaryOpNode => createNode(T.NEG, lineno, colno, { target, operator: '-' });
const pos = (lineno: number, colno: number, target: Node): UnaryOpNode => createNode(T.POS, lineno, colno, { target, operator: '+' });

// Logical operations
const and = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.AND, lineno, colno, { left, right });
const or = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.OR, lineno, colno, { left, right });
const nullishCoalesce = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.NULLISH_COALESCE, lineno, colno, { left, right });

// Comparison operations
const compare = (lineno: number, colno: number, expr: Node, ops: Node[] = []): CompareNode =>
  createNode(T.COMPARE, lineno, colno, { expr, ops });

const compareOperand = (lineno: number, colno: number, expr: Node, operator: string): CompareOperandNode =>
  createNode(T.COMPARE_OPERAND, lineno, colno, { expr, operator });

const bitwiseOr = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_OR, lineno, colno, { left, right });
const bitwiseAnd = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_AND, lineno, colno, { left, right });
const bitwiseXor = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_XOR, lineno, colno, { left, right });
const bitwiseLShift = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_LSHIFT, lineno, colno, { left, right });
const bitwiseRShift = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_RSHIFT, lineno, colno, { left, right });
const bitwiseNot = (lineno: number, colno: number, target: Node): UnaryNode => createNode(T.BITWISE_NOT, lineno, colno, { target });

const increment = (lineno: number, colno: number, target: Node, isPostfix: boolean): IncDecNode => createNode(T.INCREMENT, lineno, colno, { target, isPostfix });
const decrement = (lineno: number, colno: number, target: Node, isPostfix: boolean): IncDecNode => createNode(T.DECREMENT, lineno, colno, { target, isPostfix });

// Destructuring pattern nodes
const arrayPattern = (lineno: number, colno: number, children: Node[] = []): ChildrenNode => createNodeWithChildren(T.ARRAY_PATTERN, lineno, colno, children);
const objectPattern = (lineno: number, colno: number, children: Node[] = []): ChildrenNode => createNodeWithChildren(T.OBJECT_PATTERN, lineno, colno, children);
const patternProperty = (lineno: number, colno: number, key: Node, val: Node): PairNode => createNode(T.PATTERN_PROPERTY, lineno, colno, { key, value: val });
const restPattern = (lineno: number, colno: number, target: Node): RestPatternNode => createNode(T.REST_PATTERN, lineno, colno, { target });
const assignmentPattern = (lineno: number, colno: number, target: Node, defaultVal: Node): AssignmentPatternNode => createNode(T.ASSIGNMENT_PATTERN, lineno, colno, { target, value: defaultVal });
const hole = (lineno: number, colno: number): HoleNode => createNode(T.HOLE, lineno, colno);

// Type checks
const is = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.IS, lineno, colno, { left, right });
const in_ = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.IN, lineno, colno, { left, right });

// Statement nodes (return Node: parser mutates these fields after creation)
const block = (lineno: number, colno: number, name?: string, body?: Node): Node =>
  createNode(T.BLOCK, lineno, colno, { name, body });

/** `if_` and `inlineIf` carry the same fields; the node type is what differs. */
const if_ = (lineno: number, colno: number, fields: InlineIfFields = {}): Node =>
  createNode(T.IF, lineno, colno, { else_: null, ...fields });

interface InlineIfFields {
  cond?: Node;
  body?: Node;
  else_?: Node | null;
}

const inlineIf = (lineno: number, colno: number, fields: InlineIfFields = {}): Node =>
  createNode(T.INLINE_IF, lineno, colno, { else_: null, ...fields });

interface ForFields {
  arr?: Node;
  name?: Node;
  body?: Node;
  else_?: Node | null;
}

const for_ = (lineno: number, colno: number, fields: ForFields = {}): Node =>
  createNode(T.FOR, lineno, colno, { else_: null, ...fields });

/** Shared by `macro` and `call`, which differ only in node type. */
interface NamedBodyFields {
  name: string;
  args?: Node[];
  body?: Node;
}

const macro = (lineno: number, colno: number, fields: NamedBodyFields): Node =>
  createNode(T.MACRO, lineno, colno, { args: [], ...fields });

const caller = (lineno: number, colno: number, args: Node[] = [], body?: Node): Node =>
  createNode(T.CALLER, lineno, colno, { args, body });

const call = (lineno: number, colno: number, fields: NamedBodyFields): Node =>
  createNode(T.CALL, lineno, colno, { args: [], ...fields });

interface ImportFields {
  template: Node | string;
  target: string;
  withContext?: boolean;
}

const import_ = (lineno: number, colno: number, fields: ImportFields): Node =>
  createNode(T.IMPORT, lineno, colno, { withContext: false, ...fields });

interface FromImportFields {
  template: Node | string;
  names?: Node;
  withContext?: boolean;
}

const fromImport = (lineno: number, colno: number, fields: FromImportFields): Node =>
  createNode(T.FROM_IMPORT, lineno, colno, {
    withContext: false,
    ...fields,
    names: fields.names ?? nodeList(0, 0),
  });

interface SetFields {
  targets?: Node[];
  value?: Node;
  operator?: string | null;
}

const set = (lineno: number, colno: number, fields: SetFields = {}): Node =>
  createNode(T.SET, lineno, colno, { targets: [], operator: null, ...fields });

const capture = (lineno: number, colno: number, body: Node): Node =>
  createNode(T.CAPTURE, lineno, colno, { body });

interface TryCatchFields {
  body: Node;
  catchBody?: Node | null;
  errVar?: string | null;
}

const tryCatch = (lineno: number, colno: number, fields: TryCatchFields): Node =>
  createNode(T.TRY_CATCH, lineno, colno, {
    body: fields.body,
    catch: fields.catchBody ?? null,
    errVar: fields.errVar ?? null,
  });

const do_ = (lineno: number, colno: number, expr: Node): Node =>
  createNode(T.DO, lineno, colno, { expr });

const with_ = (lineno: number, colno: number, assignments: Node[] = [], body: Node | null = null): Node =>
  createNode(T.WITH, lineno, colno, { assignments, body });

interface SwitchFields {
  expr: Node;
  cases?: Node[];
  default_?: Node | null;
}

const switch_ = (lineno: number, colno: number, fields: SwitchFields): Node =>
  createNode(T.SWITCH, lineno, colno, {
    expr: fields.expr,
    cases: fields.cases ?? [],
    default: fields.default_ ?? null,
  });

const case_ = (lineno: number, colno: number, cond: Node, body: Node): Node =>
  createNode(T.CASE, lineno, colno, { cond, body });

// Template reference nodes
const templateRef = (lineno: number, colno: number, template: string): Node =>
  createNode(T.TEMPLATE_REF, lineno, colno, { template });

const extends_ = (lineno: number, colno: number, template?: Node): Node =>
  createNode(T.EXTENDS, lineno, colno, { template });

const include = (lineno: number, colno: number, template?: Node, ignoreMissing: boolean | null = null): Node =>
  createNode(T.INCLUDE, lineno, colno, { template, ignoreMissing });

const super_ = (lineno: number, colno: number, blockName: string, sym: Node | null = null): Node =>
  createNode(T.SUPER, lineno, colno, { blockName, symbol: sym });

// Aggregate nodes
const group = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.GROUP, lineno, colno, children);
const array = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.ARRAY, lineno, colno, children);
const dict = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.DICT, lineno, colno, children);
const pair = (lineno: number, colno: number, key: Node, val: Node): PairNode => createNode(T.PAIR, lineno, colno, { key, value: val });

const spread = (lineno: number, colno: number, argument: Node): SpreadNode => createNode(T.SPREAD, lineno, colno, { argument });
const walrus = (lineno: number, colno: number, target: Node, val: Node): WalrusNode => createNode(T.WALRUS, lineno, colno, { target, value: val });

const variableDeclaration = (lineno: number, colno: number, targets: Node[], val: Node): VariableDeclNode => createNode(T.VARIABLE_DECLARATION, lineno, colno, { targets, value: val });
const variableAssignment = (lineno: number, colno: number, targets: Node[], val: Node): VariableDeclNode => createNode(T.VARIABLE_ASSIGNMENT, lineno, colno, { targets, value: val });
interface CompoundAssignmentFields {
  targets: Node[];
  operator: string;
  value: Node;
}

const compoundAssignment = (lineno: number, colno: number, fields: CompoundAssignmentFields): CompoundAssignNode =>
  createNode(T.COMPOUND_ASSIGNMENT, lineno, colno, { ...fields });

interface DefineBlockFields {
  name: string;
  body: Node;
  args?: MacroArgument[];
}

const defineBlock = (lineno: number, colno: number, fields: DefineBlockFields): Node =>
  createNode(T.DEFINE_BLOCK, lineno, colno, { args: [], ...fields });

const templateLiteral = (lineno: number, colno: number, quasis: unknown[] = []): TemplateLiteralNode => createNode(T.TEMPLATE_LITERAL, lineno, colno, { quasis });

const keywordArgs = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.KEYWORD_ARGS, lineno, colno, children);

// Extension nodes
interface ExtensionMetadata {
  __name?: string;
  autoescape?: boolean;
}

const extensionMetadata = (ext: unknown): ExtensionMetadata => {
  if (ext !== null && typeof ext === 'object') {
    return ext as ExtensionMetadata;
  }
  return {};
};

const extensionName = (ext: unknown, metadata: ExtensionMetadata): string => {
  if (metadata.__name) {
    return metadata.__name;
  }
  if (typeof ext === 'string') {
    return ext;
  }
  return '';
};

interface CallExtensionFields {
  ext: unknown;
  prop: string;
  args?: Node;
  contentArgs?: Node[];
}

const buildCallExtension = (
  type: typeof T.CALL_EXTENSION | typeof T.CALL_EXTENSION_ASYNC,
  lineno: number,
  colno: number,
  { ext, prop, args, contentArgs }: CallExtensionFields
): CallExtensionNode => {
  const extObj = extensionMetadata(ext);
  return createNode(type, lineno, colno, {
    extName: extensionName(ext, extObj),
    prop,
    args: args ?? nodeList(0, 0),
    contentArgs: contentArgs ?? [],
    autoescape: extObj.autoescape ?? true,
  });
};

const callExtension = (lineno: number, colno: number, fields: CallExtensionFields): CallExtensionNode =>
  buildCallExtension(T.CALL_EXTENSION, lineno, colno, fields);

const callExtensionAsync = (lineno: number, colno: number, fields: CallExtensionFields): CallExtensionNode =>
  buildCallExtension(T.CALL_EXTENSION_ASYNC, lineno, colno, fields);



// ============================================
// AGGREGATE NAMESPACE (auto-generated; used by the extension API)
// ============================================
import * as guards from './types/guards.ts';
import * as traverse from './traverse.ts';

const creators = {
  node, value, nodeList, output, root,
  literal, symbol, templateData,
  funCall, pipe,
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
};

const nodes = Object.freeze({
  NODE_TYPES: T,
  ...creators,
  ...guards,
  ...traverse,
  createNode,
});

// Generic creator (for advanced usage)
export { createNode };

export { node, value, nodeList, output, root, literal, symbol, templateData, funCall, pipe, lookupVal, slice, optionalChain, optionalCall, add, sub, mul, div, floorDiv, mod, pow, concat, binOp, unaryOp, not, neg, pos, and, or, nullishCoalesce, compare, compareOperand, bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift, bitwiseNot, increment, decrement, arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern, hole, is, in_, block, if_, inlineIf, for_, macro, caller, call, import_, fromImport, set, capture, tryCatch, do_, with_, switch_, case_, templateRef, extends_, include, super_, group, array, dict, pair, spread, walrus, variableDeclaration, variableAssignment, compoundAssignment, defineBlock, templateLiteral, keywordArgs, callExtension, callExtensionAsync, nodes };
export type { SliceFields, BinaryOpFields, InlineIfFields, ForFields, NamedBodyFields, ImportFields, FromImportFields, SetFields, TryCatchFields, SwitchFields, CompoundAssignmentFields, DefineBlockFields, CallExtensionFields };
