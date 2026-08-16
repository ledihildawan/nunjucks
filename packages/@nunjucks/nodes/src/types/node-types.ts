import type { NodeLocation } from '@nunjucks/shared';
import type { NodeBase } from './base.ts';
import { type NodeType, T } from './constants.ts';
import type {
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
} from './expression-nodes.ts';
import type {
  BlockNode,
  CallExtensionNode,
  CaptureNode,
  CaseNode,
  ComponentNode,
  CompoundAssignNode,
  ExecNode,
  ExtendsNode,
  ForNode,
  FromImportNode,
  IfNode,
  ImportNode,
  IncludeNode,
  MatchNode,
  RenderNode,
  ScopeNode,
  SlotBlock,
  SuperNode,
  SwitchNode,
  VariableDeclNode,
  WhenNode,
} from './statement-nodes.ts';
import type {
  HoleNode,
  LiteralNode,
  SymbolNode,
  TemplateDataNode,
} from './value-nodes.ts';

type NodeTypeInterfaceMap = {
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

export type {
  AssignmentPatternNode,
  BinaryNode,
  BinaryOpNode,
  BlockNode,
  CallExtensionNode,
  CallNode,
  CaptureNode,
  CaseNode,
  ChildrenNode,
  CompareNode,
  CompareOperandNode,
  ComponentNode,
  CompoundAssignNode,
  ExecNode,
  ExtendsNode,
  ForNode,
  FromImportNode,
  HoleNode,
  IfNode,
  ImportNode,
  IncDecNode,
  IncludeNode,
  LiteralNode,
  LookupNode,
  MatchNode,
  Node,
  NodeBase,
  NodeLocation,
  NodeOf,
  NodeType,
  PairNode,
  RangeNode,
  RenderNode,
  RestPatternNode,
  ScopeNode,
  SliceNode,
  SlotBlock,
  SpreadNode,
  SuperNode,
  SwitchNode,
  SymbolNode,
  TemplateDataNode,
  TemplateLiteralNode,
  TemplateQuasi,
  TestCallNode,
  TestNode,
  UnaryNode,
  UnaryOpNode,
  VariableDeclNode,
  WalrusNode,
  WhenNode,
};
