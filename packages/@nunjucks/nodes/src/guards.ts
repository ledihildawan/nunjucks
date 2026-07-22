// GUARDS - Type-narrowing predicates
import { T, type Node, type NodeType } from './types.ts';

const is = <K extends NodeType>(type: K) =>
  (n: unknown): n is Node & { readonly type: K } =>
    n !== null && typeof n === 'object' && 'type' in n && (n as Node).type === type;

export const isNode = (n: unknown): n is Node =>
  n !== null && typeof n === 'object' && 'type' in n && 'lineno' in n && 'colno' in n;

export const isLiteral = is(T.LITERAL);
export const isSymbol = is(T.SYMBOL);
export const isNodeList = is(T.NODE_LIST);
export const isOutput = is(T.OUTPUT);
export const isRoot = is(T.ROOT);
export const isFunCall = is(T.FUN_CALL);
export const isPipe = is(T.PIPE);
export const isLookupVal = is(T.LOOKUP_VAL);
export const isSlice = is(T.SLICE);
export const isAdd = is(T.ADD);
export const isSub = is(T.SUB);
export const isMul = is(T.MUL);
export const isDiv = is(T.DIV);
export const isAnd = is(T.AND);
export const isOr = is(T.OR);
export const isNot = is(T.NOT);
export const isCompare = is(T.COMPARE);
export const isGroup = is(T.GROUP);
export const isArray = is(T.ARRAY);
export const isDict = is(T.DICT);
export const isPair = is(T.PAIR);
export const isFor = is(T.FOR);
export const isIf = is(T.IF);
export const isBlock = is(T.BLOCK);
export const isSet = is(T.SET);
export const isMacro = is(T.MACRO);
export const isImport = is(T.IMPORT);
export const isFromImport = is(T.FROM_IMPORT);
export const isExtends = is(T.EXTENDS);
export const isInclude = is(T.INCLUDE);
export const isSwitch = is(T.SWITCH);
export const isTryCatch = is(T.TRY_CATCH);
export const isDo = is(T.DO);
export const isWith = is(T.WITH);
export const isCallExtension = is(T.CALL_EXTENSION);
export const isCallExtensionAsync = is(T.CALL_EXTENSION_ASYNC);
export const isIs = is(T.IS);
export const isIn = is(T.IN);
export const isSpread = is(T.SPREAD);
export const isValue = is(T.VALUE);
export const isFilter = (n: unknown): n is Node & { readonly type: typeof T.FILTER | typeof T.PIPE } =>
  n !== null && typeof n === 'object' && 'type' in n && ((n as Node).type === T.FILTER || (n as Node).type === T.PIPE);
export const isConcat = is(T.CONCAT);
export const isNeg = is(T.NEG);
export const isPos = is(T.POS);
export const isSuper = is(T.SUPER);
export const isTemplateRef = is(T.TEMPLATE_REF);
export const isInlineIf = is(T.INLINE_IF);
export const isNullishCoalesce = is(T.NULLISH_COALESCE);
export const isCompareOperand = is(T.COMPARE_OPERAND);
export const isCase = is(T.CASE);
export const isCapture = is(T.CAPTURE);
export const isCaller = is(T.CALLER);
export const isCall = is(T.CALL);
export const isOptionalChain = is(T.OPTIONAL_CHAIN);
export const isOptionalCall = is(T.OPTIONAL_CALL);
export const isPipeAsync = is(T.PIPE_ASYNC);
export const isFloorDiv = is(T.FLOOR_DIV);
export const isMod = is(T.MOD);
export const isPow = is(T.POW);
export const isKeywordArgs = is(T.KEYWORD_ARGS);
export const isTemplateData = is(T.TEMPLATE_DATA);
export const isBinOp = is(T.BIN_OP);
export const isUnaryOp = is(T.UNARY_OP);
export const isWalrus = is(T.WALRUS);
export const isTemplateLiteral = is(T.TEMPLATE_LITERAL);
export const isArrayPattern = is(T.ARRAY_PATTERN);
export const isObjectPattern = is(T.OBJECT_PATTERN);
export const isPatternProperty = is(T.PATTERN_PROPERTY);
export const isRestPattern = is(T.REST_PATTERN);
export const isAssignmentPattern = is(T.ASSIGNMENT_PATTERN);
export const isHole = is(T.HOLE);
export const isPattern = (n: unknown): n is Node & {
  readonly type: typeof T.ARRAY_PATTERN | typeof T.OBJECT_PATTERN | typeof T.REST_PATTERN | typeof T.ASSIGNMENT_PATTERN | typeof T.SYMBOL | typeof T.HOLE;
} =>
  isArrayPattern(n) || isObjectPattern(n) || isRestPattern(n) ||
  isAssignmentPattern(n) || isSymbol(n) || isHole(n);
export const isVariableDeclaration = is(T.VARIABLE_DECLARATION);
export const isVariableAssignment = is(T.VARIABLE_ASSIGNMENT);
export const isCompoundAssignment = is(T.COMPOUND_ASSIGNMENT);
export const isDefineBlock = is(T.DEFINE_BLOCK);
export const isBitwiseOr = is(T.BITWISE_OR);
export const isBitwiseAnd = is(T.BITWISE_AND);
export const isBitwiseXor = is(T.BITWISE_XOR);
export const isBitwiseLShift = is(T.BITWISE_LSHIFT);
export const isBitwiseRShift = is(T.BITWISE_RSHIFT);
export const isBitwiseNot = is(T.BITWISE_NOT);
export const isIncrement = is(T.INCREMENT);
export const isDecrement = is(T.DECREMENT);
