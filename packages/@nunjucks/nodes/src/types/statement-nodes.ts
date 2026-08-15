import type { NodeBase } from './base.ts';
import type { T } from './constants.ts';
import type { ChildrenNode, PairNode } from './expression-nodes.ts';
import type { Node } from './node-types.ts';

interface BlockNode extends NodeBase {
  readonly type: typeof T.BLOCK;
  readonly name: Node | string | undefined;
  readonly body: Node;
}

interface CaptureNode extends NodeBase {
  readonly type: typeof T.CAPTURE;
  readonly body: Node;
  readonly name?: string | null;
}

interface IfNode extends NodeBase {
  readonly type: typeof T.IF | typeof T.INLINE_IF;
  readonly cond: Node;
  readonly body: Node;
  readonly alternate: Node | null;
}

interface ForNode extends NodeBase {
  readonly type: typeof T.FOR;
  readonly arr: Node;
  readonly name: Node;
  readonly body: Node;
  readonly alternate: Node | null;
}

interface ComponentNode extends NodeBase {
  readonly type: typeof T.COMPONENT;
  readonly name: string;
  readonly args: readonly Node[];
  readonly body: Node;
  readonly fallbackSlots: readonly SlotBlock[];
}

interface ExecNode extends NodeBase {
  readonly type: typeof T.EXEC;
  readonly expr: Node;
}

interface ScopeNode extends NodeBase {
  readonly type: typeof T.SCOPE;
  readonly assignments: readonly PairNode[];
  readonly body: Node;
}

interface SwitchNode extends NodeBase {
  readonly type: typeof T.SWITCH;
  readonly expr: Node;
  readonly cases: readonly CaseNode[];
  readonly default: Node | null;
}

interface CaseNode extends NodeBase {
  readonly type: typeof T.CASE;
  readonly cond: Node;
  readonly body: Node;
}

interface ExtendsNode extends NodeBase {
  readonly type: typeof T.EXTENDS;
  readonly template: Node;
}

interface IncludeNode extends NodeBase {
  readonly type: typeof T.INCLUDE;
  readonly template: Node;
  readonly ignoreMissing: boolean | null;
  readonly only?: boolean;
  readonly with?: Node;
}

interface SuperNode extends NodeBase {
  readonly type: typeof T.SUPER;
  readonly blockName: string;
  readonly symbol: Node | null;
}

interface ImportNode extends NodeBase {
  readonly type: typeof T.IMPORT;
  readonly template: Node;
  readonly target: string;
  readonly withContext: boolean;
}

interface FromImportNode extends NodeBase {
  readonly type: typeof T.FROM_IMPORT;
  readonly template: Node;
  readonly names: ChildrenNode;
  readonly withContext: boolean;
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
  readonly extName: string;
  readonly prop: string;
  readonly args: Node;
  readonly contentArgs: readonly Node[];
  readonly autoescape: boolean;
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
  readonly name: string;
  readonly params: readonly string[];
  readonly body: Node;
}

interface RenderNode extends NodeBase {
  readonly type: typeof T.RENDER;
  readonly callExpr: Node;
  readonly body: Node;
  readonly providedSlots: readonly SlotBlock[];
}

export type {
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
};
