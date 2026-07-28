// biome-ignore lint/style/noExcessiveLinesPerFile: Node type definitions file with many related interfaces
import { BracketNotation, type T } from './constants.ts';
import type { NodeType } from './constants.ts';

interface NodeBase {
  readonly type: NodeType;
  readonly lineno: number;
  readonly colno: number;
  fields?: readonly string[];
  children?: Node[];
  body?: Node | null;
  [BracketNotation]?: boolean;
  [key: string]: unknown;
}

interface ValueNode extends NodeBase {
  readonly type: typeof T.VALUE | typeof T.LITERAL | typeof T.SYMBOL | typeof T.TEMPLATE_DATA;
  value: unknown;
}

interface ChildrenNode extends NodeBase {
  readonly type:
  | typeof T.NODE_LIST | typeof T.ROOT | typeof T.OUTPUT | typeof T.GROUP
  | typeof T.ARRAY | typeof T.DICT | typeof T.ARRAY_PATTERN
  | typeof T.OBJECT_PATTERN | typeof T.KEYWORD_ARGS;
  children: Node[];
}

interface BinaryOpNode extends NodeBase {
  readonly type:
  | typeof T.ADD | typeof T.SUB | typeof T.MUL | typeof T.DIV
  | typeof T.FLOOR_DIV | typeof T.MOD | typeof T.POW;
  left: Node;
  right: Node;
  operator: string;
}

interface BinaryNode extends NodeBase {
  readonly type:
  | typeof T.CONCAT | typeof T.AND | typeof T.OR | typeof T.NULLISH_COALESCE
  | typeof T.BITWISE_OR | typeof T.BITWISE_AND | typeof T.BITWISE_XOR
  | typeof T.BITWISE_LSHIFT | typeof T.BITWISE_RSHIFT
  | typeof T.IS | typeof T.IN;
  left: Node;
  right: Node;
}

interface UnaryOpNode extends NodeBase {
  readonly type: typeof T.NOT | typeof T.NEG | typeof T.POS;
  target: Node;
  operator: string;
}

interface UnaryNode extends NodeBase {
  readonly type: typeof T.BITWISE_NOT;
  target: Node;
}

interface IncDecNode extends NodeBase {
  readonly type: typeof T.INCREMENT | typeof T.DECREMENT;
  target: Node;
  isPostfix: boolean;
}

interface CallNode extends NodeBase {
  readonly type: typeof T.FUN_CALL | typeof T.PIPE | typeof T.OPTIONAL_CALL;
  name: Node | string;
  args: Node[];
}

interface LookupNode extends NodeBase {
  readonly type: typeof T.LOOKUP_VAL | typeof T.OPTIONAL_CHAIN;
  target: Node;
  val: Node;
}

interface SliceNode extends NodeBase {
  readonly type: typeof T.SLICE;
  start: Node | null;
  stop: Node | null;
  step: Node | null;
}

interface CompareNode extends NodeBase {
  readonly type: typeof T.COMPARE;
  expr: Node;
  ops: Node[];
}

interface CompareOperandNode extends NodeBase {
  readonly type: typeof T.COMPARE_OPERAND;
  expr: Node;
  operator: string;
}

interface PairNode extends NodeBase {
  readonly type: typeof T.PAIR | typeof T.PATTERN_PROPERTY;
  key: Node;
  value: Node;
}

interface SpreadNode extends NodeBase {
  readonly type: typeof T.SPREAD;
  argument: Node;
}

interface WalrusNode extends NodeBase {
  readonly type: typeof T.WALRUS;
  target: Node;
  value: Node;
}

interface RestPatternNode extends NodeBase {
  readonly type: typeof T.REST_PATTERN;
  target: Node;
}

interface AssignmentPatternNode extends NodeBase {
  readonly type: typeof T.ASSIGNMENT_PATTERN;
  target: Node;
  value: Node;
}

interface BlockNode extends NodeBase {
  readonly type: typeof T.BLOCK;
  name?: string;
}

interface IfNode extends NodeBase {
  readonly type: typeof T.IF | typeof T.INLINE_IF;
  cond?: Node;
  else_: Node | null;
}

interface ForNode extends NodeBase {
  readonly type: typeof T.FOR;
  arr?: Node;
  name?: Node;
  else_: Node | null;
}

interface MacroNode extends NodeBase {
  readonly type: typeof T.MACRO;
  name: string;
  args: Node[];
}

interface CallerNode extends NodeBase {
  readonly type: typeof T.CALLER;
  args: Node[];
}

interface CallStmtNode extends NodeBase {
  readonly type: typeof T.CALL;
  name: string;
  args: Node[];
}

interface SetNode extends NodeBase {
  readonly type: typeof T.SET;
  targets: Node[];
  value?: Node;
  operator?: string | null;
}

interface TryCatchNode extends NodeBase {
  readonly type: typeof T.TRY_CATCH;
  catch: Node | null;
  errVar: string | null;
}

interface DoNode extends NodeBase {
  readonly type: typeof T.DO;
  expr: Node;
}

interface WithNode extends NodeBase {
  readonly type: typeof T.WITH;
  assignments: Node[];
}

interface SwitchNode extends NodeBase {
  readonly type: typeof T.SWITCH;
  expr: Node;
  cases: Node[];
  default: Node | null;
}

interface CaseNode extends NodeBase {
  readonly type: typeof T.CASE;
  cond: Node;
}

interface TemplateRefNode extends NodeBase {
  readonly type: typeof T.TEMPLATE_REF;
  template: string;
}

interface ExtendsNode extends NodeBase {
  readonly type: typeof T.EXTENDS;
  template?: Node;
}

interface IncludeNode extends NodeBase {
  readonly type: typeof T.INCLUDE;
  template?: Node;
  ignoreMissing: boolean | null;
}

interface SuperNode extends NodeBase {
  readonly type: typeof T.SUPER;
  blockName: string;
  symbol: Node | null;
}

interface ImportNode extends NodeBase {
  readonly type: typeof T.IMPORT;
  template: Node | string;
  target: string;
  withContext: boolean;
}

interface FromImportNode extends NodeBase {
  readonly type: typeof T.FROM_IMPORT;
  template: Node | string;
  names: Node;
  withContext: boolean;
}

interface HoleNode extends NodeBase {
  readonly type: typeof T.HOLE;
}

interface VariableDeclNode extends NodeBase {
  readonly type: typeof T.VARIABLE_DECLARATION | typeof T.VARIABLE_ASSIGNMENT;
  targets: Node[];
  value: Node;
}

interface CompoundAssignNode extends NodeBase {
  readonly type: typeof T.COMPOUND_ASSIGNMENT;
  targets: Node[];
  operator: string;
  value: Node;
}

interface DefineBlockNode extends NodeBase {
  readonly type: typeof T.DEFINE_BLOCK;
  name: string;
  args: MacroArgument[];
}

interface MacroArgument {
  name: string;
  defaultVal: Node | null;
}

interface TemplateLiteralNode extends NodeBase {
  readonly type: typeof T.TEMPLATE_LITERAL;
  quasis: unknown[];
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
  readonly type: typeof T.NODE | typeof T.FILTER | typeof T.BIN_OP | typeof T.UNARY_OP;
}

type Node =
| ValueNode | ChildrenNode | BinaryOpNode | BinaryNode | UnaryOpNode | UnaryNode
| IncDecNode | CallNode | LookupNode | SliceNode | CompareNode
| CompareOperandNode | PairNode | SpreadNode | WalrusNode | RestPatternNode
| AssignmentPatternNode | BlockNode | IfNode | ForNode | MacroNode | CallerNode
| CallStmtNode | SetNode | TryCatchNode | DoNode | WithNode | SwitchNode | CaseNode
| TemplateRefNode | ExtendsNode | IncludeNode | SuperNode | ImportNode | FromImportNode
| HoleNode | VariableDeclNode | CompoundAssignNode | DefineBlockNode | TemplateLiteralNode
| CallExtensionNode | GenericNode;

type NodeOf<K extends NodeType> =
  K extends typeof T.VALUE | typeof T.LITERAL | typeof T.SYMBOL | typeof T.TEMPLATE_DATA ? ValueNode
: K extends typeof T.NODE_LIST | typeof T.ROOT | typeof T.OUTPUT | typeof T.GROUP | typeof T.ARRAY | typeof T.DICT | typeof T.ARRAY_PATTERN | typeof T.OBJECT_PATTERN | typeof T.KEYWORD_ARGS ? ChildrenNode
: K extends typeof T.ADD | typeof T.SUB | typeof T.MUL | typeof T.DIV | typeof T.FLOOR_DIV | typeof T.MOD | typeof T.POW ? BinaryOpNode
: K extends typeof T.CONCAT | typeof T.AND | typeof T.OR | typeof T.NULLISH_COALESCE | typeof T.BITWISE_OR | typeof T.BITWISE_AND | typeof T.BITWISE_XOR | typeof T.BITWISE_LSHIFT | typeof T.BITWISE_RSHIFT | typeof T.IS | typeof T.IN ? BinaryNode
: K extends typeof T.NOT | typeof T.NEG | typeof T.POS ? UnaryOpNode
: K extends typeof T.BITWISE_NOT ? UnaryNode
: K extends typeof T.INCREMENT | typeof T.DECREMENT ? IncDecNode
: K extends typeof T.FUN_CALL | typeof T.PIPE | typeof T.OPTIONAL_CALL ? CallNode
: K extends typeof T.LOOKUP_VAL | typeof T.OPTIONAL_CHAIN ? LookupNode
: K extends typeof T.SLICE ? SliceNode
: K extends typeof T.COMPARE ? CompareNode
: K extends typeof T.COMPARE_OPERAND ? CompareOperandNode
: K extends typeof T.PAIR | typeof T.PATTERN_PROPERTY ? PairNode
: K extends typeof T.SPREAD ? SpreadNode
: K extends typeof T.WALRUS ? WalrusNode
: K extends typeof T.REST_PATTERN ? RestPatternNode
: K extends typeof T.ASSIGNMENT_PATTERN ? AssignmentPatternNode
: K extends typeof T.BLOCK ? BlockNode
: K extends typeof T.IF | typeof T.INLINE_IF ? IfNode
: K extends typeof T.FOR ? ForNode
: K extends typeof T.MACRO ? MacroNode
: K extends typeof T.CALLER ? CallerNode
: K extends typeof T.CALL ? CallStmtNode
: K extends typeof T.SET ? SetNode
: K extends typeof T.TRY_CATCH ? TryCatchNode
: K extends typeof T.DO ? DoNode
: K extends typeof T.WITH ? WithNode
: K extends typeof T.SWITCH ? SwitchNode
: K extends typeof T.CASE ? CaseNode
: K extends typeof T.TEMPLATE_REF ? TemplateRefNode
: K extends typeof T.EXTENDS ? ExtendsNode
: K extends typeof T.INCLUDE ? IncludeNode
: K extends typeof T.SUPER ? SuperNode
: K extends typeof T.IMPORT ? ImportNode
: K extends typeof T.FROM_IMPORT ? FromImportNode
: K extends typeof T.HOLE ? HoleNode
: K extends typeof T.VARIABLE_DECLARATION | typeof T.VARIABLE_ASSIGNMENT ? VariableDeclNode
: K extends typeof T.COMPOUND_ASSIGNMENT ? CompoundAssignNode
: K extends typeof T.DEFINE_BLOCK ? DefineBlockNode
: K extends typeof T.TEMPLATE_LITERAL ? TemplateLiteralNode
: K extends typeof T.CALL_EXTENSION | typeof T.CALL_EXTENSION_ASYNC ? CallExtensionNode
: K extends typeof T.NODE | typeof T.FILTER | typeof T.BIN_OP | typeof T.UNARY_OP ? GenericNode
: Node;



export type { NodeType, ValueNode, ChildrenNode, BinaryOpNode, BinaryNode, UnaryOpNode, UnaryNode, IncDecNode, CallNode, LookupNode, SliceNode, CompareNode, CompareOperandNode, PairNode, SpreadNode, WalrusNode, RestPatternNode, AssignmentPatternNode, BlockNode, IfNode, ForNode, MacroNode, CallerNode, CallStmtNode, SetNode, TryCatchNode, DoNode, WithNode, SwitchNode, CaseNode, TemplateRefNode, ExtendsNode, IncludeNode, SuperNode, ImportNode, FromImportNode, HoleNode, VariableDeclNode, CompoundAssignNode, DefineBlockNode, MacroArgument, TemplateLiteralNode, CallExtensionNode, GenericNode, Node, NodeOf };
