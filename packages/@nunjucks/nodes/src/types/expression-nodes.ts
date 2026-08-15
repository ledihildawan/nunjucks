import type { NodeBase } from './base.ts';
import type { T } from './constants.ts';
import type { Node } from './node-types.ts';

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

interface UnaryOpNode extends NodeBase {
  readonly type: typeof T.NOT | typeof T.NEG | typeof T.POS;
  readonly target: Node;
  readonly operator: string;
}

interface UnaryNode extends NodeBase {
  readonly type: typeof T.BITWISE_NOT;
  readonly target: Node;
}

interface IncDecNode extends NodeBase {
  readonly type: typeof T.INCREMENT | typeof T.DECREMENT;
  readonly target: Node;
  readonly isPostfix: boolean;
}

interface CallNode extends NodeBase {
  readonly type: typeof T.FUN_CALL | typeof T.PIPE | typeof T.OPTIONAL_CALL;
  readonly name: Node;
  readonly args: readonly Node[];
}

interface LookupNode extends NodeBase {
  readonly type: typeof T.LOOKUP_VAL | typeof T.OPTIONAL_CHAIN;
  readonly target: Node;
  readonly val: Node;
}

interface SliceNode extends NodeBase {
  readonly type: typeof T.SLICE;
  readonly start: Node | null;
  readonly stop: Node | null;
  readonly step: Node | null;
}

interface CompareNode extends NodeBase {
  readonly type: typeof T.COMPARE;
  readonly expr: Node;
  readonly ops: readonly Node[];
}

interface CompareOperandNode extends NodeBase {
  readonly type: typeof T.COMPARE_OPERAND;
  readonly expr: Node;
  readonly operator: string;
}

interface PairNode extends NodeBase {
  readonly type: typeof T.PAIR | typeof T.PATTERN_PROPERTY;
  readonly key: Node | string;
  readonly value: Node;
}

interface SpreadNode extends NodeBase {
  readonly type: typeof T.SPREAD;
  readonly argument: Node;
}

interface WalrusNode extends NodeBase {
  readonly type: typeof T.WALRUS;
  readonly target: Node;
  readonly value: Node;
}

interface RestPatternNode extends NodeBase {
  readonly type: typeof T.REST_PATTERN;
  readonly target: Node;
}

interface AssignmentPatternNode extends NodeBase {
  readonly type: typeof T.ASSIGNMENT_PATTERN;
  readonly target: Node;
  readonly value: Node;
}

type TemplateQuasi = { type: 'template'; value: string } | { type: 'expression'; node: Node };

interface TemplateLiteralNode extends NodeBase {
  readonly type: typeof T.TEMPLATE_LITERAL;
  readonly quasis: readonly TemplateQuasi[];
}

interface TestNode extends NodeBase {
  readonly type: typeof T.TEST;
  readonly target: Node;
  readonly name: string;
}

interface TestCallNode extends NodeBase {
  readonly type: typeof T.TEST_CALL;
  readonly target: Node;
  readonly name: string;
  readonly args: readonly Node[];
}

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
