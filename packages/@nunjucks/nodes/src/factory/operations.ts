// biome-ignore lint/style/noExcessiveLinesPerFile: operator factory catalog — per-export TSDoc plus child-array ownership copies exceed the cap; splitting is out-of-scope surface churn.
import type { Loc } from '@nunjucks/shared';
import type {
  AssignmentPatternNode,
  BinaryNode,
  BinaryOpNode,
  CallNode,
  ChildrenNode,
  CompoundAssignNode,
  IncDecNode,
  LookupNode,
  Node,
  PairNode,
  RestPatternNode,
  SliceNode,
  TestCallNode,
  TestNode,
  UnaryNode,
  UnaryOpNode,
  VariableDeclNode,
} from '../types/index.ts';
import { copy } from './atomic.ts';
import { createNode, T } from './create-node.ts';

/** Fields for a `slice` node; `null` bounds mean open-ended slicing. */
interface SliceFields {
  start: Node | null;
  stop: Node | null;
  step: Node | null;
}

/** Creates a `slice` node; `null` start/stop/step leave that bound unconstrained. */
const slice = (loc: Loc, fields: SliceFields): SliceNode => createNode(T.SLICE, loc, { ...fields });

/** Fields shared by call-shaped nodes; `args` defaults to an empty array. */
interface CallFields {
  name: Node | string;
  args?: readonly Node[];
}

// WHY: every caller-supplied child array (args, ops, targets) is copied — the node owns
// its children; caller-array mutation after construction must not reach the node (same
// ownership rule as the `children` factories and variableDeclaration below).
/** Creates a `funCall` node invoking `name` with positional `args`. */
const funCall = (loc: Loc, fields: CallFields): CallNode =>
  createNode(T.FUN_CALL, loc, { ...fields, args: copy(fields.args) });

/** Creates a `pipe` node applying a filter to the piped left-hand value. */
const pipe = (loc: Loc, fields: CallFields): CallNode =>
  createNode(T.PIPE, loc, { ...fields, args: copy(fields.args) });

/** Creates an `optionalCall` node that short-circuits to null on a nullish callee. */
const optionalCall = (loc: Loc, fields: CallFields): CallNode =>
  createNode(T.OPTIONAL_CALL, loc, { ...fields, args: copy(fields.args) });

/** Fields for lookup-shaped nodes indexing `target` with `val`. */
interface LookupFields {
  target: Node;
  val: Node;
}

/** Creates a `lookupVal` node indexing `target` with `val`. */
const lookupVal = (loc: Loc, fields: LookupFields): LookupNode =>
  createNode(T.LOOKUP_VAL, loc, { ...fields });

/** Creates an `optionalChain` lookup that short-circuits on a nullish `target`. */
const optionalChain = (loc: Loc, fields: LookupFields): LookupNode =>
  createNode(T.OPTIONAL_CHAIN, loc, { ...fields });

/** Fields for two-operand nodes; also reused by the `range` factory. */
interface BinaryFields {
  left: Node;
  right: Node;
}

/** Creates an `add` node with `operator: '+'`. */
const add = (loc: Loc, fields: BinaryFields): BinaryOpNode =>
  createNode(T.ADD, loc, { ...fields, operator: '+' });
/** Creates a `sub` node with `operator: '-'`. */
const sub = (loc: Loc, fields: BinaryFields): BinaryOpNode =>
  createNode(T.SUB, loc, { ...fields, operator: '-' });
/** Creates a `mul` node with `operator: '*'`. */
const mul = (loc: Loc, fields: BinaryFields): BinaryOpNode =>
  createNode(T.MUL, loc, { ...fields, operator: '*' });
/** Creates a `div` node with `operator: '/'`. */
const div = (loc: Loc, fields: BinaryFields): BinaryOpNode =>
  createNode(T.DIV, loc, { ...fields, operator: '/' });
/** Creates a `floorDiv` node with `operator: '//'`. */
const floorDiv = (loc: Loc, fields: BinaryFields): BinaryOpNode =>
  createNode(T.FLOOR_DIV, loc, { ...fields, operator: '//' });
/** Creates a `mod` node with `operator: '%'`. */
const mod = (loc: Loc, fields: BinaryFields): BinaryOpNode =>
  createNode(T.MOD, loc, { ...fields, operator: '%' });
/** Creates a `pow` node with `operator: '**'`. */
const pow = (loc: Loc, fields: BinaryFields): BinaryOpNode =>
  createNode(T.POW, loc, { ...fields, operator: '**' });
/** Creates a `concat` node for `~` string concatenation. */
const concat = (loc: Loc, fields: BinaryFields): BinaryNode =>
  createNode(T.CONCAT, loc, { ...fields });

/** Creates a `not` node with `operator: 'not'`. */
const not = (loc: Loc, target: Node): UnaryOpNode =>
  createNode(T.NOT, loc, { target, operator: 'not' });
/** Creates a `neg` node with `operator: '-'`. */
const neg = (loc: Loc, target: Node): UnaryOpNode =>
  createNode(T.NEG, loc, { target, operator: '-' });
/** Creates a `pos` node with `operator: '+'`. */
const pos = (loc: Loc, target: Node): UnaryOpNode =>
  createNode(T.POS, loc, { target, operator: '+' });

/** Creates an `and` node for logical conjunction. */
const and = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.AND, loc, { ...fields });
/** Creates an `or` node for logical disjunction. */
const or = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.OR, loc, { ...fields });
/** Creates a `nullishCoalesce` node yielding `right` only when `left` is null/undefined. */
const nullishCoalesce = (loc: Loc, fields: BinaryFields): BinaryNode =>
  createNode(T.NULLISH_COALESCE, loc, { ...fields });

/** Fields for a `compare` node; `ops` defaults to an empty chain. */
interface CompareFields {
  expr: Node;
  ops?: readonly Node[];
}

/** Creates a `compare` node chaining `compareOperand` tests against `expr`. */
const compare = (loc: Loc, fields: CompareFields) =>
  createNode(T.COMPARE, loc, { ...fields, ops: copy(fields.ops) });

/** Fields for a `compareOperand` node carrying one comparison operator. */
interface CompareOperandFields {
  expr: Node;
  operator: string;
}

/** Creates a `compareOperand` node binding `operator` to its right-hand `expr`. */
const compareOperand = (loc: Loc, fields: CompareOperandFields) =>
  createNode(T.COMPARE_OPERAND, loc, { ...fields });

/** Creates a `bitwiseOr` node for `|` bitwise disjunction. */
const bitwiseOr = (loc: Loc, fields: BinaryFields): BinaryNode =>
  createNode(T.BITWISE_OR, loc, { ...fields });
/** Creates a `bitwiseAnd` node for `&` bitwise conjunction. */
const bitwiseAnd = (loc: Loc, fields: BinaryFields): BinaryNode =>
  createNode(T.BITWISE_AND, loc, { ...fields });
/** Creates a `bitwiseXor` node for `^` exclusive-or. */
const bitwiseXor = (loc: Loc, fields: BinaryFields): BinaryNode =>
  createNode(T.BITWISE_XOR, loc, { ...fields });
/** Creates a `bitwiseLShift` node for `<<` left shift. */
const bitwiseLShift = (loc: Loc, fields: BinaryFields): BinaryNode =>
  createNode(T.BITWISE_LSHIFT, loc, { ...fields });
/** Creates a `bitwiseRShift` node for `>>` right shift. */
const bitwiseRShift = (loc: Loc, fields: BinaryFields): BinaryNode =>
  createNode(T.BITWISE_RSHIFT, loc, { ...fields });
/** Creates a `bitwiseNot` node complementing `target`. */
const bitwiseNot = (loc: Loc, target: Node): UnaryNode =>
  createNode(T.BITWISE_NOT, loc, { target });

/** Fields for `increment`/`decrement` nodes; `isPostfix` selects the syntax position. */
interface IncDecFields {
  target: Node;
  isPostfix: boolean;
}

/** Creates an `increment` node; `isPostfix` mirrors `x++` versus `++x` placement. */
const increment = (loc: Loc, fields: IncDecFields): IncDecNode =>
  createNode(T.INCREMENT, loc, { ...fields });
/** Creates a `decrement` node; `isPostfix` mirrors `x--` versus `--x` placement. */
const decrement = (loc: Loc, fields: IncDecFields): IncDecNode =>
  createNode(T.DECREMENT, loc, { ...fields });

/** Creates an `arrayPattern` node for destructuring sequences. */
const arrayPattern = (loc: Loc, children: readonly Node[] = []): ChildrenNode =>
  createNode(T.ARRAY_PATTERN, loc, { children: [...children] });
/** Creates an `objectPattern` node for destructuring mappings. */
const objectPattern = (loc: Loc, children: readonly Node[] = []): ChildrenNode =>
  createNode(T.OBJECT_PATTERN, loc, { children: [...children] });

/** Fields for a `patternProperty` node; `key` may be a plain string or a node. */
interface PatternPropertyFields {
  key: Node | string;
  val: Node;
}

/** Creates a `patternProperty` node binding a key inside an `objectPattern`. */
const patternProperty = (loc: Loc, fields: PatternPropertyFields): PairNode =>
  createNode(T.PATTERN_PROPERTY, loc, { key: fields.key, value: fields.val });
/** Creates a `restPattern` node collecting leftover elements during destructuring. */
const restPattern = (loc: Loc, target: Node): RestPatternNode =>
  createNode(T.REST_PATTERN, loc, { target });

/** Fields for an `assignmentPattern` node supplying a fallback value. */
interface AssignmentPatternFields {
  target: Node;
  defaultVal: Node;
}

/** Creates an `assignmentPattern` node falling back to `defaultVal` when unset. */
const assignmentPattern = (loc: Loc, fields: AssignmentPatternFields): AssignmentPatternNode =>
  createNode(T.ASSIGNMENT_PATTERN, loc, { target: fields.target, value: fields.defaultVal });

/** Creates an `is` node pairing `left` with a test on the right. */
const isOp = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.IS, loc, { ...fields });
/** Creates an `in` node testing membership of `left` in `right`. */
const inNode = (loc: Loc, fields: BinaryFields): BinaryNode => createNode(T.IN, loc, { ...fields });

/** Fields for a `test` node applying a named test to `target`. */
interface TestNodeFields {
  target: Node;
  name: string;
}

/** Creates a `test` node applying the named test to `target`. */
const testNode = (loc: Loc, fields: TestNodeFields): TestNode =>
  createNode(T.TEST, loc, { ...fields });

/** Fields for a `testCall` node; `args` defaults to an empty array. */
interface TestCallFields {
  target: Node;
  name: string;
  args?: readonly Node[];
}

/** Creates a `testCall` node applying a named test with arguments. */
const testCallNode = (loc: Loc, fields: TestCallFields): TestCallNode =>
  createNode(T.TEST_CALL, loc, { ...fields, args: copy(fields.args) });

/** Fields shared by the variable declaration and assignment factories. */
interface VariableDeclFields {
  targets: readonly Node[];
  val: Node;
}

// WHY: targets is copied — the node owns its children (same ownership rule as the
// `children` factories); a caller mutating its input array post-construction must not
// mutate the node.
const variableDeclaration = (loc: Loc, fields: VariableDeclFields): VariableDeclNode =>
  createNode(T.VARIABLE_DECLARATION, loc, { targets: [...fields.targets], value: fields.val });
/** Creates a `variableAssignment` node; `targets` is copied so the node owns its array. */
const variableAssignment = (loc: Loc, fields: VariableDeclFields): VariableDeclNode =>
  createNode(T.VARIABLE_ASSIGNMENT, loc, { targets: [...fields.targets], value: fields.val });

/** Fields for a `compoundAssignment` node such as `+=`. */
interface CompoundAssignmentFields {
  targets: Node[];
  operator: string;
  value: Node;
}

/** Creates a `compoundAssignment` node applying `operator` before assigning. */
const compoundAssignment = (loc: Loc, fields: CompoundAssignmentFields): CompoundAssignNode =>
  createNode(T.COMPOUND_ASSIGNMENT, loc, { ...fields, targets: copy(fields.targets) });

export type {
  AssignmentPatternFields,
  BinaryFields,
  CallFields,
  CompareFields,
  CompareOperandFields,
  CompoundAssignmentFields,
  IncDecFields,
  LookupFields,
  PatternPropertyFields,
  SliceFields,
  TestCallFields,
  TestNodeFields,
  VariableDeclFields,
};
export {
  add,
  and,
  arrayPattern,
  assignmentPattern,
  bitwiseAnd,
  bitwiseLShift,
  bitwiseNot,
  bitwiseOr,
  bitwiseRShift,
  bitwiseXor,
  compare,
  compareOperand,
  compoundAssignment,
  concat,
  decrement,
  div,
  floorDiv,
  funCall,
  increment,
  inNode,
  isOp,
  lookupVal,
  mod,
  mul,
  neg,
  not,
  nullishCoalesce,
  objectPattern,
  optionalCall,
  optionalChain,
  or,
  patternProperty,
  pipe,
  pos,
  pow,
  restPattern,
  slice,
  sub,
  testCallNode,
  testNode,
  variableAssignment,
  variableDeclaration,
};
