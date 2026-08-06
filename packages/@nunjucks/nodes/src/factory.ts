// biome-ignore lint/style/noExcessiveLinesPerFile: Factory file with many small related node creation functions
import { T, type Node, type NodeType, type NodeOf, FIELDS } from './types/index.ts';
import type {
  ValueNode, SymbolNode, LiteralNode, TemplateDataNode, ChildrenNode, BinaryOpNode, BinaryNode, UnaryOpNode, UnaryNode,
  IncDecNode, CallNode, LookupNode, SliceNode, CompareNode,
  CompareOperandNode, PairNode, SpreadNode, WalrusNode, RestPatternNode,
  AssignmentPatternNode, HoleNode, VariableDeclNode, CompoundAssignNode,
  TemplateLiteralNode, CallExtensionNode, TestNode, TestCallNode,
  MatchNode, WhenNode, RangeNode, CaptureNode, RenderNode, SlotBlock,
} from './types/index.ts';
import * as guards from './types/guards.ts';
import * as traverse from './traverse.ts';

const createNode = <K extends NodeType>(nodeType: K, lineno: number, colno: number, data: Record<string, unknown> = {}): NodeOf<K> => ({
    type: nodeType, lineno, colno, fields: FIELDS[nodeType], ...data,
  } as NodeOf<K>);

const createNodeWithChildren = <K extends NodeType>(nodeType: K, lineno: number, colno: number, children: readonly Node[] = []): NodeOf<K> =>
  createNode(nodeType, lineno, colno, { children: [...children] });

const node = (lineno: number, colno: number) => createNode(T.NODE, lineno, colno);
const value = (lineno: number, colno: number, val: unknown): ValueNode => createNode(T.VALUE, lineno, colno, { value: val });
const nodeList = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.NODE_LIST, lineno, colno, children);
const output = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.OUTPUT, lineno, colno, children);
const root = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.ROOT, lineno, colno, children);

const literal = (lineno: number, colno: number, val: unknown): LiteralNode => createNode(T.LITERAL, lineno, colno, { value: val });
const symbol = (lineno: number, colno: number, val: string): SymbolNode => createNode(T.SYMBOL, lineno, colno, { value: val });
const templateData = (lineno: number, colno: number, val: string): TemplateDataNode => createNode(T.TEMPLATE_DATA, lineno, colno, { value: val });
const funCall = (lineno: number, colno: number, name: Node | string, args: readonly Node[] = []): CallNode =>
  createNode(T.FUN_CALL, lineno, colno, { name, args });

const pipe = (lineno: number, colno: number, name: Node | string, args: readonly Node[] = []): CallNode =>
  createNode(T.PIPE, lineno, colno, { name, args });

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

const optionalCall = (lineno: number, colno: number, name: Node | string, args: readonly Node[] = []): CallNode =>
  createNode(T.OPTIONAL_CALL, lineno, colno, { name, args });

const add = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.ADD, lineno, colno, { left, right, operator: '+' });
const sub = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.SUB, lineno, colno, { left, right, operator: '-' });
const mul = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.MUL, lineno, colno, { left, right, operator: '*' });
const div = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.DIV, lineno, colno, { left, right, operator: '/' });
const floorDiv = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.FLOOR_DIV, lineno, colno, { left, right, operator: '//' });
const mod = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.MOD, lineno, colno, { left, right, operator: '%' });
const pow = (lineno: number, colno: number, left: Node, right: Node): BinaryOpNode => createNode(T.POW, lineno, colno, { left, right, operator: '**' });
const concat = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.CONCAT, lineno, colno, { left, right });

const not = (lineno: number, colno: number, target: Node): UnaryOpNode => createNode(T.NOT, lineno, colno, { target, operator: 'not' });
const neg = (lineno: number, colno: number, target: Node): UnaryOpNode => createNode(T.NEG, lineno, colno, { target, operator: '-' });
const pos = (lineno: number, colno: number, target: Node): UnaryOpNode => createNode(T.POS, lineno, colno, { target, operator: '+' });

const and = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.AND, lineno, colno, { left, right });
const or = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.OR, lineno, colno, { left, right });
const nullishCoalesce = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.NULLISH_COALESCE, lineno, colno, { left, right });

const compare = (lineno: number, colno: number, expr: Node, ops: readonly Node[] = []): CompareNode =>
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

const arrayPattern = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.ARRAY_PATTERN, lineno, colno, children);
const objectPattern = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.OBJECT_PATTERN, lineno, colno, children);
const patternProperty = (lineno: number, colno: number, key: Node | string, val: Node): PairNode => createNode(T.PATTERN_PROPERTY, lineno, colno, { key, value: val });
const restPattern = (lineno: number, colno: number, target: Node): RestPatternNode => createNode(T.REST_PATTERN, lineno, colno, { target });
const assignmentPattern = (lineno: number, colno: number, target: Node, defaultVal: Node): AssignmentPatternNode => createNode(T.ASSIGNMENT_PATTERN, lineno, colno, { target, value: defaultVal });
const hole = (lineno: number, colno: number): HoleNode => createNode(T.HOLE, lineno, colno);

const is = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.IS, lineno, colno, { left, right });
const in_ = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.IN, lineno, colno, { left, right });

const test = (lineno: number, colno: number, target: Node, name: string): TestNode =>
  createNode(T.TEST, lineno, colno, { target, name });

interface TestCallFields {
  target: Node;
  name: string;
  args?: readonly Node[];
}

const testCall = (lineno: number, colno: number, fields: TestCallFields): TestCallNode =>
  createNode(T.TEST_CALL, lineno, colno, { args: [], ...fields });

const block = (lineno: number, colno: number, name?: string, body?: Node) =>
  createNode(T.BLOCK, lineno, colno, { name, body });

/** `if_` and `inlineIf` carry the same fields; the node type is what differs. */
const if_ = (lineno: number, colno: number, fields: InlineIfFields = {}) =>
  createNode(T.IF, lineno, colno, { else_: null, ...fields });

interface InlineIfFields {
  cond?: Node;
  body?: Node;
  else_?: Node | null;
}

const inlineIf = (lineno: number, colno: number, fields: InlineIfFields = {}) =>
  createNode(T.INLINE_IF, lineno, colno, { else_: null, ...fields });

interface ForFields {
  arr?: Node;
  name?: Node;
  body?: Node;
  else_?: Node | null;
}

const for_ = (lineno: number, colno: number, fields: ForFields = {}) =>
  createNode(T.FOR, lineno, colno, { else_: null, ...fields });

/** Shared by `component` and `render`, which differ only in node type. */
interface ComponentFields {
  name: string;
  args?: readonly Node[];
  body?: Node;
  fallbackSlots?: SlotBlock[];
}

const component = (lineno: number, colno: number, fields: ComponentFields) =>
  createNode(T.COMPONENT, lineno, colno, { args: [], fallbackSlots: [], ...fields });

interface ImportFields {
  template: Node | string;
  target: string;
  withContext?: boolean;
}

const import_ = (lineno: number, colno: number, fields: ImportFields) =>
  createNode(T.IMPORT, lineno, colno, { withContext: false, ...fields });

interface FromImportFields {
  template: Node | string;
  names?: Node;
  withContext?: boolean;
}

const fromImport = (lineno: number, colno: number, fields: FromImportFields) =>
  createNode(T.FROM_IMPORT, lineno, colno, {
    withContext: false,
    ...fields,
    names: fields.names ?? nodeList(0, 0),
  });

const capture = (lineno: number, colno: number, body: Node, name: string | null = null): CaptureNode =>
  createNode(T.CAPTURE, lineno, colno, { body, name });

const exec_ = (lineno: number, colno: number, expr: Node) =>
  createNode(T.EXEC, lineno, colno, { expr });

const scope_ = (lineno: number, colno: number, assignments: readonly Node[] = [], body: Node | null = null) =>
  createNode(T.SCOPE, lineno, colno, { assignments, body });

interface SwitchFields {
  expr: Node;
  cases?: Node[];
  default_?: Node | null;
}

const switch_ = (lineno: number, colno: number, fields: SwitchFields) =>
  createNode(T.SWITCH, lineno, colno, {
    expr: fields.expr,
    cases: fields.cases ?? [],
    default: fields.default_ ?? null,
  });

const case_ = (lineno: number, colno: number, cond: Node, body: Node) =>
  createNode(T.CASE, lineno, colno, { cond, body });

const extends_ = (lineno: number, colno: number, template?: Node) =>
  createNode(T.EXTENDS, lineno, colno, { template });

const include = (lineno: number, colno: number, template?: Node, ignoreMissing: boolean | null = null) =>
  createNode(T.INCLUDE, lineno, colno, { template, ignoreMissing });

const super_ = (lineno: number, colno: number, blockName: string, sym: Node | null = null) =>
  createNode(T.SUPER, lineno, colno, { blockName, symbol: sym });

const group = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.GROUP, lineno, colno, children);
const array = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.ARRAY, lineno, colno, children);
const dict = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.DICT, lineno, colno, children);
const pair = (lineno: number, colno: number, key: Node | string, val: Node): PairNode => createNode(T.PAIR, lineno, colno, { key, value: val });

const spread = (lineno: number, colno: number, argument: Node): SpreadNode => createNode(T.SPREAD, lineno, colno, { argument });
const walrus = (lineno: number, colno: number, target: Node, val: Node): WalrusNode => createNode(T.WALRUS, lineno, colno, { target, value: val });

const variableDeclaration = (lineno: number, colno: number, targets: readonly Node[], val: Node): VariableDeclNode => createNode(T.VARIABLE_DECLARATION, lineno, colno, { targets, value: val });
const variableAssignment = (lineno: number, colno: number, targets: readonly Node[], val: Node): VariableDeclNode => createNode(T.VARIABLE_ASSIGNMENT, lineno, colno, { targets, value: val });
interface CompoundAssignmentFields {
  targets: Node[];
  operator: string;
  value: Node;
}

const compoundAssignment = (lineno: number, colno: number, fields: CompoundAssignmentFields): CompoundAssignNode =>
  createNode(T.COMPOUND_ASSIGNMENT, lineno, colno, { ...fields });

const templateLiteral = (lineno: number, colno: number, quasis: ({ type: 'template'; value: string } | { type: 'expression'; node: Node })[] = []): TemplateLiteralNode => createNode(T.TEMPLATE_LITERAL, lineno, colno, { quasis });

const keywordArgs = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNodeWithChildren(T.KEYWORD_ARGS, lineno, colno, children);

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

interface MatchFields {
  expr: Node;
  cases?: WhenNode[];
  default?: Node | null;
}

const match = (lineno: number, colno: number, fields: MatchFields): MatchNode =>
  createNode(T.MATCH, lineno, colno, { cases: [], default: null, ...fields });

const when = (lineno: number, colno: number, pattern: Node, body: Node, guard: Node | null = null): WhenNode =>
  createNode(T.WHEN, lineno, colno, { pattern, guard, body });

const range = (lineno: number, colno: number, left: Node, right: Node): RangeNode =>
  createNode(T.RANGE, lineno, colno, { left, right });

interface RenderFields {
  callExpr: Node;
  body: Node;
  providedSlots?: SlotBlock[];
}

const renderBlock = (lineno: number, colno: number, fields: RenderFields): RenderNode =>
  createNode(T.RENDER, lineno, colno, { providedSlots: [], ...fields });

const nodes = Object.freeze({
  NODE_TYPES: T,
  node, value, nodeList, output, root,
  literal, symbol, templateData,
  funCall, pipe,
  lookupVal, slice, optionalChain, optionalCall,
  add, sub, mul, div, floorDiv, mod, pow, concat,
  not, neg, pos,
  and, or, nullishCoalesce,
  compare, compareOperand,
  bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift, bitwiseNot,
  increment, decrement,
  is, in: in_,
  for: for_, inlineIf, if: if_,
  block, capture, exec: exec_, scope: scope_, switch: switch_, case: case_,
  extends: extends_, include, super: super_,
  group, array, dict, pair, spread, walrus, templateLiteral, keywordArgs,
  variableDeclaration, variableAssignment, compoundAssignment,
  callExtension, callExtensionAsync,
  test, testCall,
  arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern, hole,
  ...guards,
  ...traverse,
  createNode,
});

export { nodes };

export { createNode };

export {
  node, value, nodeList, output, root, literal, symbol, templateData,
  funCall, pipe, lookupVal, slice, optionalChain, optionalCall,
  add, sub, mul, div, floorDiv, mod, pow, concat,
  not, neg, pos, and, or, nullishCoalesce,
  compare, compareOperand,
  bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift, bitwiseNot,
  increment, decrement,
  arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern, hole,
  is, in_, test, testCall,
  block, if_, inlineIf, for_, component, import_, fromImport,
  capture, exec_, scope_, switch_, case_, extends_, include, super_,
  group, array, dict, pair, spread, walrus,
  variableDeclaration, variableAssignment, compoundAssignment,
  templateLiteral, keywordArgs,
  callExtension, callExtensionAsync,
  match, when,
  range,
  renderBlock,
};
export type { SliceFields, InlineIfFields, ForFields, ComponentFields, ImportFields, FromImportFields, SwitchFields, CompoundAssignmentFields, CallExtensionFields, TestCallFields, MatchFields, RenderFields };
