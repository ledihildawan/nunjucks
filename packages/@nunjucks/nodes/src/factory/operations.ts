import type { Node, BinaryOpNode, BinaryNode, UnaryOpNode, UnaryNode, IncDecNode, PairNode, RestPatternNode, AssignmentPatternNode, VariableDeclNode, CompoundAssignNode, LookupNode, SliceNode, CallNode, TestNode, TestCallNode, ChildrenNode } from '../types/index.ts';
import { T, createNode } from './internal.ts';

interface SliceFields {
  start: Node | null;
  stop: Node | null;
  step: Node | null;
}

const slice = (lineno: number, colno: number, fields: SliceFields): SliceNode =>
  createNode(T.SLICE, lineno, colno, { ...fields });

const funCall = (lineno: number, colno: number, name: Node | string, args: readonly Node[] = []): CallNode =>
  createNode(T.FUN_CALL, lineno, colno, { name, args });

const pipe = (lineno: number, colno: number, name: Node | string, args: readonly Node[] = []): CallNode =>
  createNode(T.PIPE, lineno, colno, { name, args });

const lookupVal = (lineno: number, colno: number, target: Node, val: Node): LookupNode =>
  createNode(T.LOOKUP_VAL, lineno, colno, { target, val });

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

const compare = (lineno: number, colno: number, expr: Node, ops: readonly Node[] = []) =>
  createNode(T.COMPARE, lineno, colno, { expr, ops });

const compareOperand = (lineno: number, colno: number, expr: Node, operator: string) =>
  createNode(T.COMPARE_OPERAND, lineno, colno, { expr, operator });

const bitwiseOr = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_OR, lineno, colno, { left, right });
const bitwiseAnd = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_AND, lineno, colno, { left, right });
const bitwiseXor = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_XOR, lineno, colno, { left, right });
const bitwiseLShift = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_LSHIFT, lineno, colno, { left, right });
const bitwiseRShift = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.BITWISE_RSHIFT, lineno, colno, { left, right });
const bitwiseNot = (lineno: number, colno: number, target: Node): UnaryNode => createNode(T.BITWISE_NOT, lineno, colno, { target });

const increment = (lineno: number, colno: number, target: Node, isPostfix: boolean): IncDecNode => createNode(T.INCREMENT, lineno, colno, { target, isPostfix });
const decrement = (lineno: number, colno: number, target: Node, isPostfix: boolean): IncDecNode => createNode(T.DECREMENT, lineno, colno, { target, isPostfix });

const arrayPattern = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNode(T.ARRAY_PATTERN, lineno, colno, { children: [...children] });
const objectPattern = (lineno: number, colno: number, children: readonly Node[] = []): ChildrenNode => createNode(T.OBJECT_PATTERN, lineno, colno, { children: [...children] });
const patternProperty = (lineno: number, colno: number, key: Node | string, val: Node): PairNode => createNode(T.PATTERN_PROPERTY, lineno, colno, { key, value: val });
const restPattern = (lineno: number, colno: number, target: Node): RestPatternNode => createNode(T.REST_PATTERN, lineno, colno, { target });
const assignmentPattern = (lineno: number, colno: number, target: Node, defaultVal: Node): AssignmentPatternNode => createNode(T.ASSIGNMENT_PATTERN, lineno, colno, { target, value: defaultVal });

const isOp = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.IS, lineno, colno, { left, right });
const inNode = (lineno: number, colno: number, left: Node, right: Node): BinaryNode => createNode(T.IN, lineno, colno, { left, right });

const testNode = (lineno: number, colno: number, target: Node, name: string): TestNode =>
  createNode(T.TEST, lineno, colno, { target, name });

interface TestCallFields {
  target: Node;
  name: string;
  args?: readonly Node[];
}

const testCallNode = (lineno: number, colno: number, fields: TestCallFields): TestCallNode =>
  createNode(T.TEST_CALL, lineno, colno, { args: [], ...fields });

const variableDeclaration = (lineno: number, colno: number, targets: readonly Node[], val: Node): VariableDeclNode => createNode(T.VARIABLE_DECLARATION, lineno, colno, { targets, value: val });
const variableAssignment = (lineno: number, colno: number, targets: readonly Node[], val: Node): VariableDeclNode => createNode(T.VARIABLE_ASSIGNMENT, lineno, colno, { targets, value: val });

interface CompoundAssignmentFields {
  targets: Node[];
  operator: string;
  value: Node;
}

const compoundAssignment = (lineno: number, colno: number, fields: CompoundAssignmentFields): CompoundAssignNode =>
  createNode(T.COMPOUND_ASSIGNMENT, lineno, colno, { ...fields });

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
