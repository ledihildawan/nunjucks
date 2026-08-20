// WHY: concrete-module imports — taking the value `T` from './index.ts' re-entered the
// barrel that re-exports this module, creating a module-init cycle.
import { type NodeType, T } from './constants.ts';
import type {
  CallExtensionNode,
  CallNode,
  ChildrenNode,
  CompareOperandNode,
  IfNode,
  LiteralNode,
  Node,
  SymbolNode,
  TemplateDataNode,
} from './node-types.ts';

const nodeTypes: ReadonlySet<NodeType> = new Set(Object.values(T));

const is =
  <K extends NodeType>(type: K) =>
  (n: unknown): n is Node & { readonly type: K } =>
    n !== null && typeof n === 'object' && 'type' in n && (n as { type: unknown }).type === type;

/**
 * Narrows to a `Node` by checking the `type` tag against the `T` registry plus numeric
 * `lineno`/`colno`; unknown type tags fail the check.
 */
export const isNode = (n: unknown): n is Node =>
  n !== null &&
  typeof n === 'object' &&
  'type' in n &&
  typeof n.type === 'string' &&
  nodeTypes.has(n.type as NodeType) &&
  'lineno' in n &&
  typeof n.lineno === 'number' &&
  'colno' in n &&
  typeof n.colno === 'number';

/** Narrows to a `literal` node. */
export const isLiteral = (n: unknown): n is LiteralNode => is(T.LITERAL)(n);
/** Narrows to a `symbol` node. */
export const isSymbol = (n: unknown): n is SymbolNode => is(T.SYMBOL)(n);
/** Narrows to a `nodeList` node. */
export const isNodeList = is(T.NODE_LIST);
/** Narrows to a `funCall` node. */
export const isFunCall = is(T.FUN_CALL);
/** Narrows to a `compareOperand` node. */
export const isCompareOperand = (n: unknown): n is CompareOperandNode => is(T.COMPARE_OPERAND)(n);
/** Narrows to a `pipe` node. */
export const isPipe = (n: unknown): n is CallNode & { readonly type: typeof T.PIPE } =>
  is(T.PIPE)(n);
/** Narrows to a `lookupVal` node. */
export const isLookupVal = is(T.LOOKUP_VAL);
/** Narrows to a `slice` node. */
export const isSlice = is(T.SLICE);
/** Narrows to an `array` literal node. */
export const isArray = (n: unknown): n is ChildrenNode => is(T.ARRAY)(n);
/** Narrows to a `dict` literal node. */
export const isDict = (n: unknown): n is ChildrenNode => is(T.DICT)(n);
/** Narrows to a `pair` node. */
export const isPair = is(T.PAIR);
/** Narrows to an `if` statement node. */
export const isIf = (n: unknown): n is IfNode & { readonly type: typeof T.IF } => is(T.IF)(n);
/** Narrows to a `block` node. */
export const isBlock = is(T.BLOCK);
/** Narrows to a synchronous `callExtension` node. */
export const isCallExtension = is(T.CALL_EXTENSION);
/** Narrows to an async `callExtensionAsync` node. */
export const isCallExtensionAsync = (
  n: unknown
): n is CallExtensionNode & { readonly type: typeof T.CALL_EXTENSION_ASYNC } =>
  is(T.CALL_EXTENSION_ASYNC)(n);
/** Narrows to a `spread` node. */
export const isSpread = is(T.SPREAD);
/** Narrows to an `optionalChain` node. */
export const isOptionalChain = is(T.OPTIONAL_CHAIN);
/** Narrows to an `optionalCall` node. */
export const isOptionalCall = is(T.OPTIONAL_CALL);
/** Narrows to a `keywordArgs` node. */
export const isKeywordArgs = is(T.KEYWORD_ARGS);
/** Narrows to a `templateData` node. */
export const isTemplateData = (n: unknown): n is TemplateDataNode => is(T.TEMPLATE_DATA)(n);
/** Narrows to an `arrayPattern` node. */
export const isArrayPattern = is(T.ARRAY_PATTERN);
/** Narrows to an `objectPattern` node. */
export const isObjectPattern = is(T.OBJECT_PATTERN);
/** Narrows to a `patternProperty` node. */
export const isPatternProperty = is(T.PATTERN_PROPERTY);
/** Narrows to a `restPattern` node. */
export const isRestPattern = is(T.REST_PATTERN);
/** Narrows to an `assignmentPattern` node. */
export const isAssignmentPattern = is(T.ASSIGNMENT_PATTERN);
/** Narrows to a `hole` node. */
export const isHole = is(T.HOLE);
/** Narrows to a `variableDeclaration` node. */
export const isVariableDeclaration = is(T.VARIABLE_DECLARATION);
/** Narrows to a `variableAssignment` node. */
export const isVariableAssignment = is(T.VARIABLE_ASSIGNMENT);
/**
 * Narrows to any of the uniform list-shaped types (`nodeList`, `root`, `output`,
 * `group`, `array`, `dict`, `arrayPattern`, `objectPattern`, `keywordArgs`).
 */
export const isChildrenNode = (n: unknown): n is ChildrenNode =>
  is(T.NODE_LIST)(n) ||
  is(T.ROOT)(n) ||
  is(T.OUTPUT)(n) ||
  is(T.GROUP)(n) ||
  is(T.ARRAY)(n) ||
  is(T.DICT)(n) ||
  is(T.ARRAY_PATTERN)(n) ||
  is(T.OBJECT_PATTERN)(n) ||
  is(T.KEYWORD_ARGS)(n);
