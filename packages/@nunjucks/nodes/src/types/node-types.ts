// biome-ignore lint/style/noExcessiveLinesPerFile: Node type definitions file with many related interfaces
import { BracketNotation, type T } from './constants.ts';
import type { NodeType } from './constants.ts';

interface NodeBase {
  readonly type: NodeType;
  readonly lineno: number;
  readonly colno: number;
  fields?: readonly string[];
  readonly children?: readonly Node[];
  readonly body?: Node | null;
  readonly value?: unknown;
  [BracketNotation]?: boolean;
}

type NodeLocation = Pick<NodeBase, 'lineno' | 'colno'>;

interface SymbolNode extends NodeBase {
  readonly type: typeof T.SYMBOL;
  readonly value: string;
}

interface LiteralNode extends NodeBase {
  readonly type: typeof T.LITERAL;
  readonly value: unknown;
}

interface TemplateDataNode extends NodeBase {
  readonly type: typeof T.TEMPLATE_DATA;
  readonly value: string;
}

interface ValueNode extends NodeBase {
  readonly type: typeof T.VALUE;
  readonly value: unknown;
}

interface ChildrenNode extends NodeBase {
  readonly type:
  | typeof T.NODE_LIST | typeof T.ROOT | typeof T.OUTPUT | typeof T.GROUP
  | typeof T.ARRAY | typeof T.DICT | typeof T.ARRAY_PATTERN
  | typeof T.OBJECT_PATTERN | typeof T.KEYWORD_ARGS;
  readonly children: readonly Node[];
}

interface BinaryOpNode extends NodeBase {
  readonly type:
  | typeof T.ADD | typeof T.SUB | typeof T.MUL | typeof T.DIV
  | typeof T.FLOOR_DIV | typeof T.MOD | typeof T.POW;
  readonly left: Node;
  readonly right: Node;
  readonly operator: string;
}

interface BinaryNode extends NodeBase {
  readonly type:
  | typeof T.CONCAT | typeof T.AND | typeof T.OR | typeof T.NULLISH_COALESCE
  | typeof T.BITWISE_OR | typeof T.BITWISE_AND | typeof T.BITWISE_XOR
  | typeof T.BITWISE_LSHIFT | typeof T.BITWISE_RSHIFT
  | typeof T.IS | typeof T.IN;
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

interface BlockNode extends NodeBase {
  readonly type: typeof T.BLOCK;
  name: Node | string | undefined;
  body: Node;
}

interface CaptureNode extends NodeBase {
  readonly type: typeof T.CAPTURE;
  body: Node;
  name?: string | null;
}

interface IfNode extends NodeBase {
  readonly type: typeof T.IF | typeof T.INLINE_IF;
  cond: Node;
  body: Node;
  else_: Node | null;
}

interface ForNode extends NodeBase {
  readonly type: typeof T.FOR;
  arr: Node;
  name: Node;
  body: Node;
  else_: Node | null;
}

interface ComponentNode extends NodeBase {
  readonly type: typeof T.COMPONENT;
  name: string;
  args: Node[];
  body: Node;
  fallbackSlots: SlotBlock[];
}

interface ExecNode extends NodeBase {
  readonly type: typeof T.EXEC;
  expr: Node;
}

interface ScopeNode extends NodeBase {
  readonly type: typeof T.SCOPE;
  assignments: PairNode[];
  body: Node;
}

interface SwitchNode extends NodeBase {
  readonly type: typeof T.SWITCH;
  expr: Node;
  cases: CaseNode[];
  default: Node | null;
}

interface CaseNode extends NodeBase {
  readonly type: typeof T.CASE;
  cond: Node;
  body: Node;
}

interface ExtendsNode extends NodeBase {
  readonly type: typeof T.EXTENDS;
  template: Node;
}

interface IncludeNode extends NodeBase {
  readonly type: typeof T.INCLUDE;
  template: Node;
  ignoreMissing: boolean | null;
  only?: boolean;
  with?: Node;
}

interface SuperNode extends NodeBase {
  readonly type: typeof T.SUPER;
  blockName: string;
  symbol: Node | null;
}

interface ImportNode extends NodeBase {
  readonly type: typeof T.IMPORT;
  template: Node;
  target: string;
  withContext: boolean;
}

interface FromImportNode extends NodeBase {
  readonly type: typeof T.FROM_IMPORT;
  template: Node;
  names: ChildrenNode;
  withContext: boolean;
}

interface HoleNode extends NodeBase {
  readonly type: typeof T.HOLE;
}

interface VariableDeclNode extends NodeBase {
  readonly type: typeof T.VARIABLE_DECLARATION | typeof T.VARIABLE_ASSIGNMENT;
  readonly targets: readonly Node[];
  readonly value: Node;
}

interface CompoundAssignNode extends NodeBase {
  readonly type: typeof T.COMPOUND_ASSIGNMENT;
  readonly targets: readonly Node[];
  readonly operator: string;
  readonly value: Node;
}

type TemplateQuasi =
  | { type: 'template'; value: string }
  | { type: 'expression'; node: Node };

interface TemplateLiteralNode extends NodeBase {
  readonly type: typeof T.TEMPLATE_LITERAL;
  readonly quasis: readonly TemplateQuasi[];
}

interface CallExtensionNode extends NodeBase {
  readonly type: typeof T.CALL_EXTENSION | typeof T.CALL_EXTENSION_ASYNC;
  extName: string;
  prop: string;
  args: Node;
  contentArgs: Node[];
  autoescape: boolean;
}

interface GenericNode extends NodeBase {
  readonly type: typeof T.NODE;
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

interface WhenNode extends NodeBase {
  readonly type: typeof T.WHEN;
  readonly pattern: Node;
  readonly guard: Node | null;
  readonly body: Node;
}

interface MatchNode extends NodeBase {
  readonly type: typeof T.MATCH;
  readonly expr: Node;
  readonly cases: readonly WhenNode[];
  readonly default: Node | null;
}

interface RangeNode extends NodeBase {
  readonly type: typeof T.RANGE;
  readonly left: Node;
  readonly right: Node;
}

interface SlotBlock {
  name: string;
  params: string[];
  body: Node;
}

interface RenderNode extends NodeBase {
  readonly type: typeof T.RENDER;
  readonly callExpr: Node;
  readonly body: Node;
  readonly providedSlots: readonly SlotBlock[];
}

/**
 * Single source of truth: maps each `NodeType` literal to its TypeScript
 * interface. Adding a new node type requires only:
 *   1. Add the literal to `T` in `constants.ts`
 *   2. Add the interface above
 *   3. Add ONE entry here
 *   4. Add the factory + guard
 * `NodeOf<K>` and the `Node` union are both derived from this map, so they
 * can never drift out of sync.
 */
type NodeTypeInterfaceMap = {
  [T.NODE]: GenericNode;
  [T.VALUE]: ValueNode;
  [T.LITERAL]: LiteralNode;
  [T.SYMBOL]: SymbolNode;
  [T.TEMPLATE_DATA]: TemplateDataNode;
  [T.NODE_LIST]: ChildrenNode;
  [T.ROOT]: ChildrenNode;
  [T.OUTPUT]: ChildrenNode;
  [T.GROUP]: ChildrenNode;
  [T.ARRAY]: ChildrenNode;
  [T.DICT]: ChildrenNode;
  [T.ARRAY_PATTERN]: ChildrenNode;
  [T.OBJECT_PATTERN]: ChildrenNode;
  [T.KEYWORD_ARGS]: ChildrenNode;
  [T.ADD]: BinaryOpNode;
  [T.SUB]: BinaryOpNode;
  [T.MUL]: BinaryOpNode;
  [T.DIV]: BinaryOpNode;
  [T.FLOOR_DIV]: BinaryOpNode;
  [T.MOD]: BinaryOpNode;
  [T.POW]: BinaryOpNode;
  [T.CONCAT]: BinaryNode;
  [T.AND]: BinaryNode;
  [T.OR]: BinaryNode;
  [T.NULLISH_COALESCE]: BinaryNode;
  [T.BITWISE_OR]: BinaryNode;
  [T.BITWISE_AND]: BinaryNode;
  [T.BITWISE_XOR]: BinaryNode;
  [T.BITWISE_LSHIFT]: BinaryNode;
  [T.BITWISE_RSHIFT]: BinaryNode;
  [T.IS]: BinaryNode;
  [T.IN]: BinaryNode;
  [T.NOT]: UnaryOpNode;
  [T.NEG]: UnaryOpNode;
  [T.POS]: UnaryOpNode;
  [T.BITWISE_NOT]: UnaryNode;
  [T.INCREMENT]: IncDecNode;
  [T.DECREMENT]: IncDecNode;
  [T.FUN_CALL]: CallNode;
  [T.PIPE]: CallNode;
  [T.OPTIONAL_CALL]: CallNode;
  [T.LOOKUP_VAL]: LookupNode;
  [T.OPTIONAL_CHAIN]: LookupNode;
  [T.SLICE]: SliceNode;
  [T.COMPARE]: CompareNode;
  [T.COMPARE_OPERAND]: CompareOperandNode;
  [T.PAIR]: PairNode;
  [T.PATTERN_PROPERTY]: PairNode;
  [T.SPREAD]: SpreadNode;
  [T.WALRUS]: WalrusNode;
  [T.REST_PATTERN]: RestPatternNode;
  [T.ASSIGNMENT_PATTERN]: AssignmentPatternNode;
  [T.BLOCK]: BlockNode;
  [T.CAPTURE]: CaptureNode;
  [T.IF]: IfNode;
  [T.INLINE_IF]: IfNode;
  [T.FOR]: ForNode;
  [T.COMPONENT]: ComponentNode;
  [T.EXEC]: ExecNode;
  [T.SCOPE]: ScopeNode;
  [T.SWITCH]: SwitchNode;
  [T.CASE]: CaseNode;
  [T.EXTENDS]: ExtendsNode;
  [T.INCLUDE]: IncludeNode;
  [T.SUPER]: SuperNode;
  [T.IMPORT]: ImportNode;
  [T.FROM_IMPORT]: FromImportNode;
  [T.HOLE]: HoleNode;
  [T.VARIABLE_DECLARATION]: VariableDeclNode;
  [T.VARIABLE_ASSIGNMENT]: VariableDeclNode;
  [T.COMPOUND_ASSIGNMENT]: CompoundAssignNode;
  [T.TEMPLATE_LITERAL]: TemplateLiteralNode;
  [T.CALL_EXTENSION]: CallExtensionNode;
  [T.CALL_EXTENSION_ASYNC]: CallExtensionNode;
  [T.TEST]: TestNode;
  [T.TEST_CALL]: TestCallNode;
  [T.MATCH]: MatchNode;
  [T.WHEN]: WhenNode;
  [T.RANGE]: RangeNode;
  [T.RENDER]: RenderNode;
};

type Node = NodeTypeInterfaceMap[NodeType];

type NodeOf<K extends NodeType> = NodeTypeInterfaceMap[K];



export type { NodeType, ValueNode, SymbolNode, LiteralNode, TemplateDataNode, ChildrenNode, BinaryOpNode, BinaryNode, UnaryOpNode, UnaryNode, IncDecNode, CallNode, LookupNode, SliceNode, CompareNode, CompareOperandNode, PairNode, SpreadNode, WalrusNode, RestPatternNode, AssignmentPatternNode, BlockNode, CaptureNode, IfNode, ForNode, ComponentNode, ExecNode, ScopeNode, SwitchNode, CaseNode, ExtendsNode, IncludeNode, SuperNode, ImportNode, FromImportNode, HoleNode, VariableDeclNode, CompoundAssignNode, TemplateLiteralNode, TemplateQuasi, CallExtensionNode, GenericNode, TestNode, TestCallNode, MatchNode, WhenNode, RangeNode, RenderNode, SlotBlock, Node, NodeOf, NodeLocation };
