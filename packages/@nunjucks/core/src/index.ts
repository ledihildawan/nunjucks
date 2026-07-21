// ============================================
// @nunjucks/core - Nunjucks Template Engine Core
// Integrated packages for blazing fast performance
// ============================================

// Re-export all packages
export { T, BracketNotation } from '@nunjucks/nodes/types';
export { type Node, type HasChildren, type NodeType } from '@nunjucks/nodes/types';
export { createNode, createChildNode } from '@nunjucks/nodes/types';

// Node creators
export {
  node, value, nodeList, output, root,
  literal, symbol, templateData,
  funCall, pipe, pipeAsync, callExtension, callExtensionAsync,
  lookupVal, slice, optionalChain, optionalCall,
  add, sub, mul, div, floorDiv, mod, pow, concat,
  not, neg, pos,
  and, or, nullishCoalesce, compare, compareOperand,
  bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift, bitwiseNot,
  increment, decrement,
  group, array, dict, pair,
  arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern, hole,
  is, in_ as in,
  block, if_, inlineIf, for_, macro, caller, call, import_, fromImport, set,
  capture, tryCatch, do_, with_, switch_, case_,
  templateRef, extends_, include, super_,
  spread, walrus, variableDeclaration, variableAssignment, compoundAssignment,
  defineBlock, templateLiteral, keywordArgs,
  Filter, FilterAsync, LiteralNode
} from '@nunjucks/nodes/factory';

// Type guards
export {
  is, isFilter, isPattern,
  isNode, isLiteral, isSymbol, isNodeList, isOutput, isRoot,
  isFunCall, isPipe, isLookupVal, isSlice, isAdd, isSub, isMul, isDiv,
  isAnd, isOr, isNot, isCompare, isGroup, isArray, isDict, isPair,
  isFor, isIf, isBlock, isSet, isMacro, isImport, isFromImport,
  isExtends, isInclude, isSwitch, isTryCatch, isDo, isWith,
  isCallExtension, isIs, isIn, isSpread
} from '@nunjucks/nodes/guards';

// Traversal
export {
  walk, depthWalk, findAll, findFirst, count,
  nodes, filterNodes
} from '@nunjucks/transformers/walk';
export { liftPipes } from '@nunjucks/transformers/pipe';
export { liftSuper } from '@nunjucks/transformers/super';
export { convertStatements } from '@nunjucks/transformers/statement';
export { createGensym, createSymbolGenerator } from '@nunjucks/transformers/symbol';

// Runtime
export { createFrame, lookup, set, type Frame } from '@nunjucks/runtime/frame';
export { createContext, type Context } from '@nunjucks/runtime/context';

// Compiler
export { createEmitter, emit, emitLine, getCode, type Emitter } from '@nunjucks/compiler/emit';
export { compile } from '@nunjucks/compiler/compile';

// Log
export {
  createLog,
  toText, toAnsi, toHtml, toConsoleString,
  classify, CSS, PRODUCTION_BODY, TOGGLE_SCRIPT
} from '@nunjucks/log';
