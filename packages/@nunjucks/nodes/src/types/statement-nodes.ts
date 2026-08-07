import type { T } from './constants.ts';
import type { Node } from './node-types.ts';
import type { NodeBase } from './base.ts';
import type { PairNode, ChildrenNode } from './expression-nodes.ts';

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

interface CallExtensionNode extends NodeBase {
  readonly type: typeof T.CALL_EXTENSION | typeof T.CALL_EXTENSION_ASYNC;
  extName: string;
  prop: string;
  args: Node;
  contentArgs: Node[];
  autoescape: boolean;
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

export type {
  BlockNode,
  CaptureNode,
  IfNode,
  ForNode,
  ComponentNode,
  ExecNode,
  ScopeNode,
  SwitchNode,
  CaseNode,
  ExtendsNode,
  IncludeNode,
  SuperNode,
  ImportNode,
  FromImportNode,
  VariableDeclNode,
  CompoundAssignNode,
  CallExtensionNode,
  WhenNode,
  MatchNode,
  SlotBlock,
  RenderNode,
};