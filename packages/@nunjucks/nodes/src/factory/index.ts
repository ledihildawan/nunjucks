import { T, createNode } from './internal.ts';
import * as guards from '../types/guards.ts';
import * as traverse from '../traverse.ts';
import {
  node, value, nodeList, output, root,
  literal, symbol, templateData,
  hole,
  group, array, dict, pair, spread, walrus,
  templateLiteral, keywordArgs,
  range,
} from './atomic.ts';
import {
  slice, funCall, pipe, lookupVal, optionalChain, optionalCall,
  add, sub, mul, div, floorDiv, mod, pow, concat,
  not, neg, pos, and, or, nullishCoalesce,
  compare, compareOperand,
  bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift, bitwiseNot,
  increment, decrement,
  arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern,
  isOp, inNode, testNode, testCallNode,
  variableDeclaration, variableAssignment, compoundAssignment,
} from './operations.ts';
import {
  block, ifNode, inlineIf, forNode,
  component, importNode, fromImportNode,
  capture, execNode, scopeNode,
  switchNode, caseNode, extendsNode, include, superNode,
  match, when, renderNode,
  callExtension, callExtensionAsync,
} from './control.ts';

export { createNode };

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
  is: isOp, in: inNode,
  for: forNode, inlineIf, if: ifNode,
  block, capture, exec: execNode, scope: scopeNode, switch: switchNode, case: caseNode,
  extends: extendsNode, include, super: superNode,
  group, array, dict, pair, spread, walrus, templateLiteral, keywordArgs,
  variableDeclaration, variableAssignment, compoundAssignment,
  callExtension, callExtensionAsync,
  test: testNode, testCall: testCallNode,
  arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern, hole,
  ...guards,
  ...traverse,
  createNode,
});

export { nodes };

export {
  node, value, nodeList, output, root, literal, symbol, templateData,
  funCall, pipe, lookupVal, slice, optionalChain, optionalCall,
  add, sub, mul, div, floorDiv, mod, pow, concat,
  not, neg, pos, and, or, nullishCoalesce,
  compare, compareOperand,
  bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift, bitwiseNot,
  increment, decrement,
  arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern, hole,
  isOp, inNode, testNode, testCallNode,
  block, ifNode, inlineIf, forNode, component, importNode, fromImportNode,
  capture, execNode, scopeNode, switchNode, caseNode, extendsNode, include, superNode,
  group, array, dict, pair, spread, walrus,
  variableDeclaration, variableAssignment, compoundAssignment,
  templateLiteral, keywordArgs,
  callExtension, callExtensionAsync,
  match, when,
  range,
  renderNode,
};
import type {
  SliceFields, TestCallFields, CompoundAssignmentFields,
  CallFields, LookupFields, BinaryFields, CompareFields, CompareOperandFields,
  IncDecFields, PatternPropertyFields, AssignmentPatternFields, TestNodeFields, VariableDeclFields,
} from './operations.ts';
import type { PairFields, SpreadFields, WalrusFields } from './atomic.ts';
import type {
  InlineIfFields, ForFields, ComponentFields, ImportFields,
  FromImportFields, SwitchFields, CallExtensionFields,
  MatchFields, RenderFields, BlockFields, CaptureFields, ScopeFields, CaseFields, IncludeFields, SuperFields, WhenFields,
} from './control.ts';

export type {
  SliceFields, InlineIfFields, ForFields, ComponentFields, ImportFields,
  FromImportFields, SwitchFields, CompoundAssignmentFields, CallExtensionFields,
  TestCallFields, MatchFields, RenderFields,
  CallFields, LookupFields, BinaryFields, CompareFields, CompareOperandFields,
  IncDecFields, PatternPropertyFields, AssignmentPatternFields, TestNodeFields, VariableDeclFields,
  PairFields, SpreadFields, WalrusFields,
  BlockFields, CaptureFields, ScopeFields, CaseFields, IncludeFields, SuperFields, WhenFields,
};
