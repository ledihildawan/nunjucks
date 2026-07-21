// GUARDS - Type predicates
// Import directly: import { is, isNode } from '@nunjucks/nodes/guards'

import { T, type Node } from './types.ts';

const is = (type: string) => (n: unknown): boolean => (n as Node)?.type === type;

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
export const isIs = is(T.IS);
export const isIn = is(T.IN);
export const isSpread = is(T.SPREAD);
