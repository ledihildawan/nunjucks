import type { Node, BinaryOpNode, BinaryNode, UnaryOpNode, UnaryNode, IncDecNode, PairNode, RestPatternNode, AssignmentPatternNode, VariableDeclNode, CompoundAssignNode, LookupNode, SliceNode, CallNode, TestNode, TestCallNode, ChildrenNode } from '../types/index.ts';
import type { Loc } from '@nunjucks/lexer';
import { T, createNode } from './internal.ts';

interface SliceFields {
  start: Node | null;
  stop: Node | null;
  step: Node | null;
}

const slice = (loc: Loc, fields: SliceFields): SliceNode =>
  createNode(T.SLICE, loc, { ...fields });

interface CallFields {
  name: Node | string;
  args?: readonly Node[];
}

const funCall = (loc: Loc, fields: CallFields): CallNode =>
  createNode(T.FUN_CALL, loc, { args: [], ...fields });

const pipe = (loc: Loc, fields: CallFields): CallNode =>
  createNode(T.PIPE, loc, { args: [], ...fields });

const optionalCall = (loc: Loc, fields: CallFields): CallNode =>
  createNode(T.OPTIONAL_CALL, loc, { args: [], ...fields });

interface LookupFields {
  target: Node;
  val: Node;
}

const lookupVal = (loc: Loc, fields: LookupFields): LookupNode =>
  createNode(T.LOOKUP_VAL, loc, { ...fields });

const optionalChain = (loc: Loc, fields: LookupFields): LookupNode =>
  createNode(T.OPTIONAL_CHAIN, loc, { ...fields });

interface BinaryFields {
  left: Node;
  right: Node;
}

const add = (loc: Loc, fields: BinaryFields): BinaryOpNode => createNode(T.ADD, loc, { ...fields, operator: '+' });
const sub = (loc: Loc, fields: BinaryFields): BinaryOpNode => createNode(T.SUB, loc, { ...fields, operator: '-' });
const mul = (loc: Loc, fields: BinaryFields): BinaryOpNode => createNode(T.MUL, loc, { ...fields, operator: '*' });
const div = (loc: Loc, fields: BinaryFields): BinaryOpNode => createNode(T.DIV, loc, { ...fields, operator: '/' });
const floorDiv = (loc: Loc, fields: BinaryFields): BinaryOpNode => createNode(T.FLOOR_DIV, loc, { ...fields, operator: '//' });
const mod = (loc: Loc, fields: BinaryFields): BinaryOpNode => createNode(T.MOD, loc, { ...fields, operator: '%' });
const pow = (loc: Loc, fields: BinaryFields): BinaryOpNode => createNode(T.POW, loc, { ...fields, operator: '**' });
const concat = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.CONCAT, loc, { ...fields });

const not = (loc: Loc, target: Node): UnaryOpNode => createNode(T.NOT, loc, { target, operator: 'not' });
const neg = (loc: Loc, target: Node): UnaryOpNode => createNode(T.NEG, loc, { target, operator: '-' });
const pos = (loc: Loc, target: Node): UnaryOpNode => createNode(T.POS, loc, { target, operator: '+' });

const and = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.AND, loc, { ...fields });
const or = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.OR, loc, { ...fields });
const nullishCoalesce = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.NULLISH_COALESCE, loc, { ...fields });

interface CompareFields {
  expr: Node;
  ops?: readonly Node[];
}

const compare = (loc: Loc, fields: CompareFields) =>
  createNode(T.COMPARE, loc, { ops: [], ...fields });

interface CompareOperandFields {
  expr: Node;
  operator: string;
}

const compareOperand = (loc: Loc, fields: CompareOperandFields) =>
  createNode(T.COMPARE_OPERAND, loc, { ...fields });

const bitwiseOr = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.BITWISE_OR, loc, { ...fields });
const bitwiseAnd = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.BITWISE_AND, loc, { ...fields });
const bitwiseXor = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.BITWISE_XOR, loc, { ...fields });
const bitwiseLShift = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.BITWISE_LSHIFT, loc, { ...fields });
const bitwiseRShift = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.BITWISE_RSHIFT, loc, { ...fields });
const bitwiseNot = (loc: Loc, target: Node): UnaryNode => createNode(T.BITWISE_NOT, loc, { target });

interface IncDecFields {
  target: Node;
  isPostfix: boolean;
}

const increment = (loc: Loc, fields: IncDecFields): IncDecNode => createNode(T.INCREMENT, loc, { ...fields });
const decrement = (loc: Loc, fields: IncDecFields): IncDecNode => createNode(T.DECREMENT, loc, { ...fields });

const arrayPattern = (loc: Loc, children: readonly Node[] = []): ChildrenNode => createNode(T.ARRAY_PATTERN, loc, { children: [...children] });
const objectPattern = (loc: Loc, children: readonly Node[] = []): ChildrenNode => createNode(T.OBJECT_PATTERN, loc, { children: [...children] });

interface PatternPropertyFields {
  key: Node | string;
  val: Node;
}

const patternProperty = (loc: Loc, fields: PatternPropertyFields): PairNode => createNode(T.PATTERN_PROPERTY, loc, { key: fields.key, value: fields.val });
const restPattern = (loc: Loc, target: Node): RestPatternNode => createNode(T.REST_PATTERN, loc, { target });

interface AssignmentPatternFields {
  target: Node;
  defaultVal: Node;
}

const assignmentPattern = (loc: Loc, fields: AssignmentPatternFields): AssignmentPatternNode => createNode(T.ASSIGNMENT_PATTERN, loc, { target: fields.target, value: fields.defaultVal });

const isOp = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.IS, loc, { ...fields });
const inNode = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.IN, loc, { ...fields });

interface TestNodeFields {
  target: Node;
  name: string;
}

const testNode = (loc: Loc, fields: TestNodeFields): TestNode =>
  createNode(T.TEST, loc, { ...fields });

interface TestCallFields {
  target: Node;
  name: string;
  args?: readonly Node[];
}

const testCallNode = (loc: Loc, fields: TestCallFields): TestCallNode =>
  createNode(T.TEST_CALL, loc, { args: [], ...fields });

interface VariableDeclFields {
  targets: readonly Node[];
  val: Node;
}

const variableDeclaration = (loc: Loc, fields: VariableDeclFields): VariableDeclNode => createNode(T.VARIABLE_DECLARATION, loc, { targets: fields.targets, value: fields.val });
const variableAssignment = (loc: Loc, fields: VariableDeclFields): VariableDeclNode => createNode(T.VARIABLE_ASSIGNMENT, loc, { targets: fields.targets, value: fields.val });

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
export type {
  SliceFields, CallFields, LookupFields, BinaryFields, CompareFields, CompareOperandFields,
  IncDecFields, PatternPropertyFields, AssignmentPatternFields, TestNodeFields, TestCallFields,
  VariableDeclFields, CompoundAssignmentFields,
};
