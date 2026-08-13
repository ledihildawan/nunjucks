import { T, type CallExtensionNode, type CallNode, type ChildrenNode, type CompareOperandNode, type ForNode, type IfNode, type LiteralNode, type MatchNode, type Node, type NodeType, type RenderNode, type SwitchNode, type SymbolNode, type TemplateDataNode, type TemplateLiteralNode, type TestNode, type TestCallNode } from './index.ts';

const nodeTypes: ReadonlySet<NodeType> = new Set(Object.values(T));

const is = <K extends NodeType>(type: K) =>
  (n: unknown): n is Node & { readonly type: K } =>
    n !== null && typeof n === 'object' && 'type' in n && (n as { type: unknown }).type === type;

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

export const isLiteral = (n: unknown): n is LiteralNode => is(T.LITERAL)(n);
export const isSymbol = (n: unknown): n is SymbolNode => is(T.SYMBOL)(n);
export const isNodeList = is(T.NODE_LIST);
export const isOutput = (n: unknown): n is ChildrenNode & { readonly type: typeof T.OUTPUT } => is(T.OUTPUT)(n);
export const isFunCall = is(T.FUN_CALL);
export const isCompareOperand = (n: unknown): n is CompareOperandNode => is(T.COMPARE_OPERAND)(n);
export const isPipe = (n: unknown): n is CallNode & { readonly type: typeof T.PIPE } => is(T.PIPE)(n);
export const isLookupVal = is(T.LOOKUP_VAL);
export const isSlice = is(T.SLICE);
export const isArray = (n: unknown): n is ChildrenNode => is(T.ARRAY)(n);
export const isDict = (n: unknown): n is ChildrenNode => is(T.DICT)(n);
export const isPair = is(T.PAIR);
export const isFor = (n: unknown): n is ForNode => is(T.FOR)(n);
export const isIf = (n: unknown): n is IfNode & { readonly type: typeof T.IF } => is(T.IF)(n);
export const isBlock = is(T.BLOCK);
export const isCallExtension = is(T.CALL_EXTENSION);
export const isCallExtensionAsync = (n: unknown): n is CallExtensionNode & { readonly type: typeof T.CALL_EXTENSION_ASYNC } => is(T.CALL_EXTENSION_ASYNC)(n);
export const isSpread = is(T.SPREAD);
export const isOptionalChain = is(T.OPTIONAL_CHAIN);
export const isOptionalCall = is(T.OPTIONAL_CALL);
export const isKeywordArgs = is(T.KEYWORD_ARGS);
export const isTemplateData = (n: unknown): n is TemplateDataNode => is(T.TEMPLATE_DATA)(n);
export const isArrayPattern = is(T.ARRAY_PATTERN);
export const isObjectPattern = is(T.OBJECT_PATTERN);
export const isPatternProperty = is(T.PATTERN_PROPERTY);
export const isRestPattern = is(T.REST_PATTERN);
export const isAssignmentPattern = is(T.ASSIGNMENT_PATTERN);
export const isHole = is(T.HOLE);
export const isVariableDeclaration = is(T.VARIABLE_DECLARATION);
export const isVariableAssignment = is(T.VARIABLE_ASSIGNMENT);
export const isTest = (n: unknown): n is TestNode => is(T.TEST)(n);
export const isTestCall = (n: unknown): n is TestCallNode => is(T.TEST_CALL)(n);
export const isMatch = (n: unknown): n is MatchNode => is(T.MATCH)(n);
export const isSwitch = (n: unknown): n is SwitchNode => is(T.SWITCH)(n);
export const isRender = (n: unknown): n is RenderNode => is(T.RENDER)(n);
export const isTemplateLiteral = (n: unknown): n is TemplateLiteralNode => is(T.TEMPLATE_LITERAL)(n);
export const isChildrenNode = (n: unknown): n is ChildrenNode => is(T.NODE_LIST)(n) || is(T.ROOT)(n) || is(T.OUTPUT)(n) || is(T.GROUP)(n) || is(T.ARRAY)(n) || is(T.DICT)(n) || is(T.ARRAY_PATTERN)(n) || is(T.OBJECT_PATTERN)(n) || is(T.KEYWORD_ARGS)(n);
