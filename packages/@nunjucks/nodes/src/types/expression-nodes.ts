import type { NodeBase } from './base.ts';
import type { T } from './constants.ts';
import type { Node } from './node-types.ts';

/**
 * List-shaped nodes that hold their sub-nodes in one uniform `children` slot, letting
 * traversal treat every container kind identically.
 */
interface ChildrenNode extends NodeBase {
  readonly type:
    | typeof T.NODE_LIST
    | typeof T.ROOT
    | typeof T.OUTPUT
    | typeof T.GROUP
    | typeof T.ARRAY
    | typeof T.DICT
    | typeof T.ARRAY_PATTERN
    | typeof T.OBJECT_PATTERN
    | typeof T.KEYWORD_ARGS;
  readonly children: readonly Node[];
}

/** Arithmetic nodes carrying their `operator` literal alongside `left`/`right`. */
interface BinaryOpNode extends NodeBase {
  readonly type:
    | typeof T.ADD
    | typeof T.SUB
    | typeof T.MUL
    | typeof T.DIV
    | typeof T.FLOOR_DIV
    | typeof T.MOD
    | typeof T.POW;
  readonly left: Node;
  readonly right: Node;
  readonly operator: string;
}

/** Two-operand nodes (logical, bitwise, `is`/`in`) with no `operator` field. */
interface BinaryNode extends NodeBase {
  readonly type:
    | typeof T.CONCAT
    | typeof T.AND
    | typeof T.OR
    | typeof T.NULLISH_COALESCE
    | typeof T.BITWISE_OR
    | typeof T.BITWISE_AND
    | typeof T.BITWISE_XOR
    | typeof T.BITWISE_LSHIFT
    | typeof T.BITWISE_RSHIFT
    | typeof T.IS
    | typeof T.IN;
  readonly left: Node;
  readonly right: Node;
}

/** Prefix arithmetic-logical nodes carrying their `operator` literal. */
interface UnaryOpNode extends NodeBase {
  readonly type: typeof T.NOT | typeof T.NEG | typeof T.POS;
  readonly target: Node;
  readonly operator: string;
}

/** Single-operand node (`bitwiseNot`) with no `operator` field. */
interface UnaryNode extends NodeBase {
  readonly type: typeof T.BITWISE_NOT;
  readonly target: Node;
}

/** `increment`/`decrement` nodes; `isPostfix` records the syntax position used. */
interface IncDecNode extends NodeBase {
  readonly type: typeof T.INCREMENT | typeof T.DECREMENT;
  readonly target: Node;
  readonly isPostfix: boolean;
}

/** Call-shaped nodes (`funCall`, `pipe`, `optionalCall`) sharing `name` and `args`. */
interface CallNode extends NodeBase {
  readonly type: typeof T.FUN_CALL | typeof T.PIPE | typeof T.OPTIONAL_CALL;
  readonly name: Node;
  readonly args: readonly Node[];
}

/** Indexing nodes (`lookupVal`, `optionalChain`) reading `val` off `target`. */
interface LookupNode extends NodeBase {
  readonly type: typeof T.LOOKUP_VAL | typeof T.OPTIONAL_CHAIN;
  readonly target: Node;
  readonly val: Node;
}

/** Slice bounds where `null` leaves the corresponding end unconstrained. */
interface SliceNode extends NodeBase {
  readonly type: typeof T.SLICE;
  readonly start: Node | null;
  readonly stop: Node | null;
  readonly step: Node | null;
}

/** Chained comparison holding its `compareOperand` tests in `ops`. */
interface CompareNode extends NodeBase {
  readonly type: typeof T.COMPARE;
  readonly expr: Node;
  readonly ops: readonly Node[];
}

/** One link of a comparison chain binding an `operator` to its right-hand `expr`. */
interface CompareOperandNode extends NodeBase {
  readonly type: typeof T.COMPARE_OPERAND;
  readonly expr: Node;
  readonly operator: string;
}

/** Key/value binding shared by `pair` and `patternProperty`; `key` may be a string. */
interface PairNode extends NodeBase {
  readonly type: typeof T.PAIR | typeof T.PATTERN_PROPERTY;
  readonly key: Node | string;
  readonly value: Node;
}

/** Spread element expanding `argument` into a call, array, or dict. */
interface SpreadNode extends NodeBase {
  readonly type: typeof T.SPREAD;
  readonly argument: Node;
}

/** Inline assignment expression assigning `value` to `target` while yielding it. */
interface WalrusNode extends NodeBase {
  readonly type: typeof T.WALRUS;
  readonly target: Node;
  readonly value: Node;
}

/** Rest element collecting leftovers during pattern destructuring. */
interface RestPatternNode extends NodeBase {
  readonly type: typeof T.REST_PATTERN;
  readonly target: Node;
}

/** Pattern element falling back to `value` when the target is unset. */
interface AssignmentPatternNode extends NodeBase {
  readonly type: typeof T.ASSIGNMENT_PATTERN;
  readonly target: Node;
  readonly value: Node;
}

/**
 * One segment of a template literal: either static `template` text or an interpolated
 * expression kept in its `{type:'expression', node}` envelope.
 */
type TemplateQuasi = { type: 'template'; value: string } | { type: 'expression'; node: Node };

/**
 * Backtick template literal holding alternating static and interpolated `quasis`;
 * expression quasis stay enveloped so traversal reaches the inner nodes.
 */
interface TemplateLiteralNode extends NodeBase {
  readonly type: typeof T.TEMPLATE_LITERAL;
  readonly quasis: readonly TemplateQuasi[];
}

/** Application of a named test to `target`, as produced by `is` without arguments. */
interface TestNode extends NodeBase {
  readonly type: typeof T.TEST;
  readonly target: Node;
  readonly name: string;
}

/** Application of a named test with positional `args`. */
interface TestCallNode extends NodeBase {
  readonly type: typeof T.TEST_CALL;
  readonly target: Node;
  readonly name: string;
  readonly args: readonly Node[];
}

/** Range expression over inclusive `left` and exclusive `right` bounds. */
interface RangeNode extends NodeBase {
  readonly type: typeof T.RANGE;
  readonly left: Node;
  readonly right: Node;
}

export type {
  AssignmentPatternNode,
  BinaryNode,
  BinaryOpNode,
  CallNode,
  ChildrenNode,
  CompareNode,
  CompareOperandNode,
  IncDecNode,
  LookupNode,
  PairNode,
  RangeNode,
  RestPatternNode,
  SliceNode,
  SpreadNode,
  TemplateLiteralNode,
  TemplateQuasi,
  TestCallNode,
  TestNode,
  UnaryNode,
  UnaryOpNode,
  WalrusNode,
};
