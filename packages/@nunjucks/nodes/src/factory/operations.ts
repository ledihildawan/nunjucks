import type { Node, BinaryOpNode, BinaryNode, UnaryOpNode, UnaryNode, IncDecNode, PairNode, RestPatternNode, AssignmentPatternNode, VariableDeclNode, CompoundAssignNode, LookupNode, SliceNode, CallNode, TestNode, TestCallNode, ChildrenNode } from '../types/index.ts';
import type { Loc } from '@nunjucks/shared';
import { T, createNode } from './internal.ts';

interface SliceFields {
  start: Node | null;
  stop: Node | null;
  step: Node | null;
}

const slice = (loc: Loc, fields: SliceFields): SliceNode =>
  createNode(T.SLICE, loc, { ...fields });

const funCall = (loc: Loc, name: Node | string, args: readonly Node[] = []): CallNode =>
  createNode(T.FUN_CALL, loc, { name, args });

const pipe = (loc: Loc, name: Node | string, args: readonly Node[] = []): CallNode =>
  createNode(T.PIPE, loc, { name, args });

const lookupVal = (loc: Loc, target: Node, val: Node): LookupNode =>
  createNode(T.LOOKUP_VAL, loc, { target, val });

const optionalChain = (loc: Loc, target: Node, val: Node): LookupNode =>
  createNode(T.OPTIONAL_CHAIN, loc, { target, val });

const optionalCall = (loc: Loc, name: Node | string, args: readonly Node[] = []): CallNode =>
  createNode(T.OPTIONAL_CALL, loc, { name, args });

const add = (loc: Loc, left: Node, right: Node): BinaryOpNode => createNode(T.ADD, loc, { left, right, operator: '+' });
const sub = (loc: Loc, left: Node, right: Node): BinaryOpNode => createNode(T.SUB, loc, { left, right, operator: '-' });
const mul = (loc: Loc, left: Node, right: Node): BinaryOpNode => createNode(T.MUL, loc, { left, right, operator: '*' });
const div = (loc: Loc, left: Node, right: Node): BinaryOpNode => createNode(T.DIV, loc, { left, right, operator: '/' });
const floorDiv = (loc: Loc, left: Node, right: Node): BinaryOpNode => createNode(T.FLOOR_DIV, loc, { left, right, operator: '//' });
const mod = (loc: Loc, left: Node, right: Node): BinaryOpNode => createNode(T.MOD, loc, { left, right, operator: '%' });
const pow = (loc: Loc, left: Node, right: Node): BinaryOpNode => createNode(T.POW, loc, { left, right, operator: '**' });
const concat = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.CONCAT, loc, { left, right });

const not = (loc: Loc, target: Node): UnaryOpNode => createNode(T.NOT, loc, { target, operator: 'not' });
const neg = (loc: Loc, target: Node): UnaryOpNode => createNode(T.NEG, loc, { target, operator: '-' });
const pos = (loc: Loc, target: Node): UnaryOpNode => createNode(T.POS, loc, { target, operator: '+' });

const and = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.AND, loc, { left, right });
const or = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.OR, loc, { left, right });
const nullishCoalesce = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.NULLISH_COALESCE, loc, { left, right });

const compare = (loc: Loc, expr: Node, ops: readonly Node[] = []) =>
  createNode(T.COMPARE, loc, { expr, ops });

const compareOperand = (loc: Loc, expr: Node, operator: string) =>
  createNode(T.COMPARE_OPERAND, loc, { expr, operator });

const bitwiseOr = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_OR, loc, { left, right });
const bitwiseAnd = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_AND, loc, { left, right });
const bitwiseXor = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_XOR, loc, { left, right });
const bitwiseLShift = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_LSHIFT, loc, { left, right });
const bitwiseRShift = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_RSHIFT, loc, { left, right });
const bitwiseNot = (loc: Loc, target: Node): UnaryNode => createNode(T.BITWISE_NOT, loc, { target });

const increment = (loc: Loc, target: Node, isPostfix: boolean): IncDecNode => createNode(T.INCREMENT, loc, { target, isPostfix });
const decrement = (loc: Loc, target: Node, isPostfix: boolean): IncDecNode => createNode(T.DECREMENT, loc, { target, isPostfix });

const arrayPattern = (loc: Loc, children: readonly Node[] = []): ChildrenNode => createNode(T.ARRAY_PATTERN, loc, { children: [...children] });
const objectPattern = (loc: Loc, children: readonly Node[] = []): ChildrenNode => createNode(T.OBJECT_PATTERN, loc, { children: [...children] });
const patternProperty = (loc: Loc, key: Node | string, val: Node): PairNode => createNode(T.PATTERN_PROPERTY, loc, { key, value: val });
const restPattern = (loc: Loc, target: Node): RestPatternNode => createNode(T.REST_PATTERN, loc, { target });
const assignmentPattern = (loc: Loc, target: Node, defaultVal: Node): AssignmentPatternNode => createNode(T.ASSIGNMENT_PATTERN, loc, { target, value: defaultVal });

const isOp = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.IS, loc, { left, right });
const inNode = (loc: Loc, left: Node, right: Node): BinaryNode => createNode(T.IN, loc, { left, right });

const testNode = (loc: Loc, target: Node, name: string): TestNode =>
  createNode(T.TEST, loc, { target, name });

interface TestCallFields {
  target: Node;
  name: string;
  args?: readonly Node[];
}

const testCallNode = (loc: Loc, fields: TestCallFields): TestCallNode =>
  createNode(T.TEST_CALL, loc, { args: [], ...fields });

const variableDeclaration = (loc: Loc, targets: readonly Node[], val: Node): VariableDeclNode => createNode(T.VARIABLE_DECLARATION, loc, { targets, value: val });
const variableAssignment = (loc: Loc, targets: readonly Node[], val: Node): VariableDeclNode => createNode(T.VARIABLE_ASSIGNMENT, loc, { targets, value: val });

interface CompoundAssignmentFields {
  targets: Node[];
  operator: string;
  value: Node;
}

const compoundAssignment = (loc: Loc, fields: CompoundAssignmentFields): CompoundAssignNode =>
  createNode(T.COMPOUND_ASSIGNMENT, loc, { ...fields });

export {
  slice, funCall, pipe, lookupVal, optionalChain, optionalCall,
  add, sub, mul, div, floorDiv, mod, pow, concat,
  not, neg, pos, and, or, nullishCoalesce,
  compare, compareOperand,
  bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift, bitwiseNot,
  increment, decrement,
  arrayPattern, objectPattern, patternProperty, restPattern, assignmentPattern,
  isOp, inNode, testNode, testCallNode,
  variableDeclaration, variableAssignment, compoundAssignment,
};
export type { SliceFields, TestCallFields, CompoundAssignmentFields };
