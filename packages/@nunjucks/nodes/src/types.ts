// TYPES - Core type definitions and constants
export const T = Object.freeze({
  NODE: 'node',
  VALUE: 'value',
  LITERAL: 'literal',
  SYMBOL: 'symbol',
  NODE_LIST: 'nodeList',
  OUTPUT: 'output',
  FUN_CALL: 'funCall',
  PIPE: 'pipe',
  FILTER: 'filter',
  BLOCK: 'block',
  EXTENDS: 'extends',
  INCLUDE: 'include',
  MACRO: 'macro',
  SET: 'set',
  IF: 'if',
  FOR: 'for',
  COMPARE: 'compare',
  LOOKUP_VAL: 'lookupVal',
  CALL_EXTENSION: 'callExtension',
  CALL_EXTENSION_ASYNC: 'callExtensionAsync',
  DICT: 'dict',
  ARRAY: 'array',
  PAIR: 'pair',
  CONCAT: 'concat',
  ADD: 'add',
  SUB: 'sub',
  MUL: 'mul',
  DIV: 'div',
  FLOOR_DIV: 'floorDiv',
  MOD: 'mod',
  POW: 'pow',
  BIN_OP: 'binOp',
  UNARY_OP: 'unaryOp',
  KEYWORD_ARGS: 'keywordArgs',
  ROOT: 'root',
  SLICE: 'slice',
  GROUP: 'group',
  TEMPLATE_DATA: 'templateData',
  INLINE_IF: 'inlineIf',
  OR: 'or',
  AND: 'and',
  NOT: 'not',
  COMPARE_OPERAND: 'compareOperand',
  NEG: 'neg',
  POS: 'pos',
  SUPER: 'super',
  TEMPLATE_REF: 'templateRef',
  IMPORT: 'import',
  FROM_IMPORT: 'fromImport',
  SWITCH: 'switch',
  CASE: 'case',
  CAPTURE: 'capture',
  CALLER: 'caller',
  CALL: 'call',
  OPTIONAL_CHAIN: 'optionalChain',
  OPTIONAL_CALL: 'optionalCall',
  NULLISH_COALESCE: 'nullishCoalesce',
  IN: 'in',
  TRY_CATCH: 'tryCatch',
  DO: 'do',
  WITH: 'with',
  IS: 'is',
  SPREAD: 'spread',
  WALRUS: 'walrus',
  TEMPLATE_LITERAL: 'templateLiteral',
  VARIABLE_DECLARATION: 'variableDeclaration',
  VARIABLE_ASSIGNMENT: 'variableAssignment',
  COMPOUND_ASSIGNMENT: 'compoundAssignment',
  DEFINE_BLOCK: 'defineBlock',
  BITWISE_OR: 'bitwiseOr',
  BITWISE_AND: 'bitwiseAnd',
  BITWISE_XOR: 'bitwiseXor',
  BITWISE_LSHIFT: 'bitwiseLShift',
  BITWISE_RSHIFT: 'bitwiseRShift',
  BITWISE_NOT: 'bitwiseNot',
  INCREMENT: 'increment',
  DECREMENT: 'decrement',
  ARRAY_PATTERN: 'arrayPattern',
  OBJECT_PATTERN: 'objectPattern',
  PATTERN_PROPERTY: 'patternProperty',
  REST_PATTERN: 'restPattern',
  ASSIGNMENT_PATTERN: 'assignmentPattern',
  HOLE: 'hole',
} as const);

export type NodeType = typeof T[keyof typeof T];

export const BracketNotation = Symbol('BracketNotation');

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

export interface ValueNode extends NodeBase {
  readonly type: typeof T.VALUE | typeof T.LITERAL | typeof T.SYMBOL | typeof T.TEMPLATE_DATA;
  value: unknown;
}

export interface ChildrenNode extends NodeBase {
  readonly type:
  | typeof T.NODE_LIST | typeof T.ROOT | typeof T.OUTPUT | typeof T.GROUP
  | typeof T.ARRAY | typeof T.DICT | typeof T.ARRAY_PATTERN
  | typeof T.OBJECT_PATTERN | typeof T.KEYWORD_ARGS;
  children: Node[];
}

export interface BinaryOpNode extends NodeBase {
  readonly type:
  | typeof T.ADD | typeof T.SUB | typeof T.MUL | typeof T.DIV
  | typeof T.FLOOR_DIV | typeof T.MOD | typeof T.POW;
  left: Node;
  right: Node;
  operator: string;
}

export interface BinaryNode extends NodeBase {
  readonly type:
  | typeof T.CONCAT | typeof T.AND | typeof T.OR | typeof T.NULLISH_COALESCE
  | typeof T.BITWISE_OR | typeof T.BITWISE_AND | typeof T.BITWISE_XOR
  | typeof T.BITWISE_LSHIFT | typeof T.BITWISE_RSHIFT
  | typeof T.IS | typeof T.IN;
  left: Node;
  right: Node;
}

export interface UnaryOpNode extends NodeBase {
  readonly type: typeof T.NOT | typeof T.NEG | typeof T.POS;
  target: Node;
  operator: string;
}

export interface UnaryNode extends NodeBase {
  readonly type: typeof T.BITWISE_NOT;
  target: Node;
}

export interface IncDecNode extends NodeBase {
  readonly type: typeof T.INCREMENT | typeof T.DECREMENT;
  target: Node;
  isPostfix: boolean;
}

export interface CallNode extends NodeBase {
  readonly type: typeof T.FUN_CALL | typeof T.PIPE | typeof T.OPTIONAL_CALL;
  name: Node | string;
  args: Node[];
}

export interface LookupNode extends NodeBase {
  readonly type: typeof T.LOOKUP_VAL | typeof T.OPTIONAL_CHAIN;
  target: Node;
  val: Node;
}

export interface SliceNode extends NodeBase {
  readonly type: typeof T.SLICE;
  start: Node | null;
  stop: Node | null;
  step: Node | null;
}

export interface CompareNode extends NodeBase {
  readonly type: typeof T.COMPARE;
  expr: Node;
  ops: Node[];
}

export interface CompareOperandNode extends NodeBase {
  readonly type: typeof T.COMPARE_OPERAND;
  expr: Node;
  operator: string;
}

export interface PairNode extends NodeBase {
  readonly type: typeof T.PAIR | typeof T.PATTERN_PROPERTY;
  key: Node;
  value: Node;
}

export interface SpreadNode extends NodeBase {
  readonly type: typeof T.SPREAD;
  argument: Node;
}

export interface WalrusNode extends NodeBase {
  readonly type: typeof T.WALRUS;
  target: Node;
  value: Node;
}

export interface RestPatternNode extends NodeBase {
  readonly type: typeof T.REST_PATTERN;
  target: Node;
}

export interface AssignmentPatternNode extends NodeBase {
  readonly type: typeof T.ASSIGNMENT_PATTERN;
  target: Node;
  value: Node;
}

export interface BlockNode extends NodeBase {
  readonly type: typeof T.BLOCK;
  name?: string;
}

export interface IfNode extends NodeBase {
  readonly type: typeof T.IF | typeof T.INLINE_IF;
  cond?: Node;
  else_: Node | null;
}

export interface ForNode extends NodeBase {
  readonly type: typeof T.FOR;
  arr?: Node;
  name?: Node;
  else_: Node | null;
}

export interface MacroNode extends NodeBase {
  readonly type: typeof T.MACRO;
  name: string;
  args: Node[];
}

export interface CallerNode extends NodeBase {
  readonly type: typeof T.CALLER;
  args: Node[];
}

export interface CallStmtNode extends NodeBase {
  readonly type: typeof T.CALL;
  name: string;
  args: Node[];
}

export interface SetNode extends NodeBase {
  readonly type: typeof T.SET;
  targets: Node[];
  value?: Node;
  operator?: string | null;
}

export interface TryCatchNode extends NodeBase {
  readonly type: typeof T.TRY_CATCH;
  catch: Node | null;
  errVar: string | null;
}

export interface DoNode extends NodeBase {
  readonly type: typeof T.DO;
  expr: Node;
}

export interface WithNode extends NodeBase {
  readonly type: typeof T.WITH;
  assignments: Node[];
}

export interface SwitchNode extends NodeBase {
  readonly type: typeof T.SWITCH;
  expr: Node;
  cases: Node[];
  default: Node | null;
}

export interface CaseNode extends NodeBase {
  readonly type: typeof T.CASE;
  cond: Node;
}

export interface TemplateRefNode extends NodeBase {
  readonly type: typeof T.TEMPLATE_REF;
  template: string;
}

export interface ExtendsNode extends NodeBase {
  readonly type: typeof T.EXTENDS;
  template?: Node;
}

export interface IncludeNode extends NodeBase {
  readonly type: typeof T.INCLUDE;
  template?: Node;
  ignoreMissing: boolean | null;
}

export interface SuperNode extends NodeBase {
  readonly type: typeof T.SUPER;
  blockName: string;
  symbol: Node | null;
}

export interface ImportNode extends NodeBase {
  readonly type: typeof T.IMPORT;
  template: Node | string;
  target: string;
  withContext: boolean;
}

export interface FromImportNode extends NodeBase {
  readonly type: typeof T.FROM_IMPORT;
  template: Node | string;
  names: Node;
  withContext: boolean;
}

export interface HoleNode extends NodeBase {
  readonly type: typeof T.HOLE;
}

export interface VariableDeclNode extends NodeBase {
  readonly type: typeof T.VARIABLE_DECLARATION | typeof T.VARIABLE_ASSIGNMENT;
  targets: Node[];
  value: Node;
}

export interface CompoundAssignNode extends NodeBase {
  readonly type: typeof T.COMPOUND_ASSIGNMENT;
  targets: Node[];
  operator: string;
  value: Node;
}

export interface DefineBlockNode extends NodeBase {
  readonly type: typeof T.DEFINE_BLOCK;
  name: string;
  args: MacroArgument[];
}

export interface MacroArgument {
  name: string;
  defaultVal: Node | null;
}

export interface TemplateLiteralNode extends NodeBase {
  readonly type: typeof T.TEMPLATE_LITERAL;
  quasis: unknown[];
}

export interface CallExtensionNode extends NodeBase {
  readonly type: typeof T.CALL_EXTENSION | typeof T.CALL_EXTENSION_ASYNC;
  extName: string;
  prop: string;
  args: Node;
  contentArgs: Node[];
  autoescape: boolean;
}

export interface GenericNode extends NodeBase {
  readonly type: typeof T.NODE | typeof T.FILTER | typeof T.BIN_OP | typeof T.UNARY_OP;
}

export type Node =
| ValueNode | ChildrenNode | BinaryOpNode | BinaryNode | UnaryOpNode | UnaryNode
| IncDecNode | CallNode | LookupNode | SliceNode | CompareNode
| CompareOperandNode | PairNode | SpreadNode | WalrusNode | RestPatternNode
| AssignmentPatternNode | BlockNode | IfNode | ForNode | MacroNode | CallerNode
| CallStmtNode | SetNode | TryCatchNode | DoNode | WithNode | SwitchNode | CaseNode
| TemplateRefNode | ExtendsNode | IncludeNode | SuperNode | ImportNode | FromImportNode
| HoleNode | VariableDeclNode | CompoundAssignNode | DefineBlockNode | TemplateLiteralNode
| CallExtensionNode | GenericNode;

export type NodeOf<K extends NodeType> =
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

export const FIELDS: Readonly<Record<NodeType, readonly string[]>> = {
  [T.NODE]: [],
  [T.VALUE]: ['value'],
  [T.LITERAL]: ['value'],
  [T.SYMBOL]: ['value'],
  [T.TEMPLATE_DATA]: ['value'],
  [T.NODE_LIST]: ['children'],
  [T.OUTPUT]: ['children'],
  [T.ROOT]: ['children'],
  [T.GROUP]: ['children'],
  [T.ARRAY]: ['children'],
  [T.DICT]: ['children'],
  [T.ARRAY_PATTERN]: ['children'],
  [T.OBJECT_PATTERN]: ['children'],
  [T.KEYWORD_ARGS]: ['children'],
  [T.FUN_CALL]: ['name', 'args'],
  [T.PIPE]: ['name', 'args'],
  [T.FILTER]: [],
  [T.OPTIONAL_CALL]: ['name', 'args'],
  [T.LOOKUP_VAL]: ['target', 'val'],
  [T.OPTIONAL_CHAIN]: ['target', 'val'],
  [T.SLICE]: ['start', 'stop', 'step'],
  [T.ADD]: ['left', 'right', 'operator'],
  [T.SUB]: ['left', 'right', 'operator'],
  [T.MUL]: ['left', 'right', 'operator'],
  [T.DIV]: ['left', 'right', 'operator'],
  [T.FLOOR_DIV]: ['left', 'right', 'operator'],
  [T.MOD]: ['left', 'right', 'operator'],
  [T.POW]: ['left', 'right', 'operator'],
  [T.CONCAT]: ['left', 'right'],
  [T.BIN_OP]: [],
  [T.UNARY_OP]: [],
  [T.AND]: ['left', 'right'],
  [T.OR]: ['left', 'right'],
  [T.NOT]: ['target', 'operator'],
  [T.NEG]: ['target', 'operator'],
  [T.POS]: ['target', 'operator'],
  [T.COMPARE]: ['expr', 'ops'],
  [T.COMPARE_OPERAND]: ['expr', 'operator'],
  [T.NULLISH_COALESCE]: ['left', 'right'],
  [T.IN]: ['left', 'right'],
  [T.IS]: ['left', 'right'],
  [T.BITWISE_OR]: ['left', 'right'],
  [T.BITWISE_AND]: ['left', 'right'],
  [T.BITWISE_XOR]: ['left', 'right'],
  [T.BITWISE_LSHIFT]: ['left', 'right'],
  [T.BITWISE_RSHIFT]: ['left', 'right'],
  [T.BITWISE_NOT]: ['target'],
  [T.INCREMENT]: ['target', 'isPostfix'],
  [T.DECREMENT]: ['target', 'isPostfix'],
  [T.BLOCK]: ['name', 'body'],
  [T.EXTENDS]: ['template'],
  [T.INCLUDE]: ['template', 'ignoreMissing'],
  [T.MACRO]: ['name', 'args', 'body'],
  [T.CALLER]: ['args', 'body'],
  [T.CALL]: ['name', 'args', 'body'],
  [T.IMPORT]: ['template', 'target', 'withContext'],
  [T.FROM_IMPORT]: ['template', 'names', 'withContext'],
  [T.SET]: ['targets', 'value', 'operator'],
  [T.IF]: ['cond', 'body', 'else_'],
  [T.INLINE_IF]: ['cond', 'body', 'else_'],
  [T.FOR]: ['arr', 'name', 'body', 'else_'],
  [T.SWITCH]: ['expr', 'cases', 'default'],
  [T.CASE]: ['cond', 'body'],
  [T.CAPTURE]: ['body'],
  [T.TRY_CATCH]: ['body', 'catch', 'errVar'],
  [T.DO]: ['expr'],
  [T.WITH]: ['assignments', 'body'],
  [T.SUPER]: ['blockName', 'symbol'],
  [T.TEMPLATE_REF]: ['template'],
  [T.SPREAD]: ['argument'],
  [T.WALRUS]: ['target', 'value'],
  [T.TEMPLATE_LITERAL]: ['quasis'],
  [T.VARIABLE_DECLARATION]: ['targets', 'value'],
  [T.VARIABLE_ASSIGNMENT]: ['targets', 'value'],
  [T.COMPOUND_ASSIGNMENT]: ['targets', 'operator', 'value'],
  [T.DEFINE_BLOCK]: ['name', 'body', 'args'],
  [T.PATTERN_PROPERTY]: ['key', 'value'],
  [T.REST_PATTERN]: ['target'],
  [T.ASSIGNMENT_PATTERN]: ['target', 'value'],
  [T.PAIR]: ['key', 'value'],
  [T.HOLE]: [],
  [T.CALL_EXTENSION]: ['extName', 'prop', 'args', 'contentArgs', 'autoescape'],
  [T.CALL_EXTENSION_ASYNC]: ['extName', 'prop', 'args', 'contentArgs', 'autoescape'],
};
