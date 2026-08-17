import type { NodeBase } from './base.ts';
import type { T } from './constants.ts';
import type { ChildrenNode, PairNode } from './expression-nodes.ts';
import type { Node } from './node-types.ts';

/** Named, overridable template region; `name` may be an expression node or string. */
interface BlockNode extends NodeBase {
  readonly type: typeof T.BLOCK;
  readonly name: Node | string | undefined;
  readonly body: Node;
}

/** Region rendered to a string instead of output; `name` stays `null` when anonymous. */
interface CaptureNode extends NodeBase {
  readonly type: typeof T.CAPTURE;
  readonly body: Node;
  readonly name?: string | null;
}

/** Conditional covering both `if` statements and `inlineIf` expression forms. */
interface IfNode extends NodeBase {
  readonly type: typeof T.IF | typeof T.INLINE_IF;
  readonly cond: Node;
  readonly body: Node;
  readonly alternate: Node | null;
}

/** Loop over `arr` with `name` destructuring and an optional `alternate` branch. */
interface ForNode extends NodeBase {
  readonly type: typeof T.FOR;
  readonly arr: Node;
  readonly name: Node;
  readonly body: Node;
  readonly alternate: Node | null;
}

/** Template invoked as a custom tag, with args, a body, and fallback slot content. */
interface ComponentNode extends NodeBase {
  readonly type: typeof T.COMPONENT;
  readonly name: string;
  readonly args: readonly Node[];
  readonly body: Node;
  readonly fallbackSlots: readonly SlotBlock[];
}

/** Wrapper evaluating `expr` purely for side effects, discarding its value. */
interface ExecNode extends NodeBase {
  readonly type: typeof T.EXEC;
  readonly expr: Node;
}

/** Lexical scope exposing `pair` assignments (`walrus` binds) to its body only. */
interface ScopeNode extends NodeBase {
  readonly type: typeof T.SCOPE;
  readonly assignments: readonly PairNode[];
  readonly body: Node;
}

/** Dispatcher comparing `expr` against `case` children, with an optional `default`. */
interface SwitchNode extends NodeBase {
  readonly type: typeof T.SWITCH;
  readonly expr: Node;
  readonly cases: readonly CaseNode[];
  readonly default: Node | null;
}

/** One `switch` arm guarding `body` behind a matching `cond`. */
interface CaseNode extends NodeBase {
  readonly type: typeof T.CASE;
  readonly cond: Node;
  readonly body: Node;
}

/** Reference to the parent template this template inherits from. */
interface ExtendsNode extends NodeBase {
  readonly type: typeof T.EXTENDS;
  readonly template: Node;
}

/** Inlined template render; `ignoreMissing: null` means unset, `only` drops context. */
interface IncludeNode extends NodeBase {
  readonly type: typeof T.INCLUDE;
  readonly template: Node;
  readonly ignoreMissing: boolean | null;
  readonly only?: boolean;
  readonly with?: Node;
}

/** Render of a parent block's content; `symbol` stays `null` unless overridden. */
interface SuperNode extends NodeBase {
  readonly type: typeof T.SUPER;
  readonly blockName: string;
  readonly symbol: Node | null;
}

/** Whole-template import; `withContext` controls passing the current context. */
interface ImportNode extends NodeBase {
  readonly type: typeof T.IMPORT;
  readonly template: Node;
  readonly target: string;
  readonly withContext: boolean;
}

/** Selective import whose `names` list is always a `nodeList`, never `undefined`. */
interface FromImportNode extends NodeBase {
  readonly type: typeof T.FROM_IMPORT;
  readonly template: Node;
  readonly names: ChildrenNode;
  readonly withContext: boolean;
}

/** Shared shape of `variableDeclaration` and `variableAssignment`. */
interface VariableDeclNode extends NodeBase {
  readonly type: typeof T.VARIABLE_DECLARATION | typeof T.VARIABLE_ASSIGNMENT;
  readonly targets: readonly Node[];
  readonly value: Node;
}

/** Augmented assignment (`+=` and friends) carrying its `operator`. */
interface CompoundAssignNode extends NodeBase {
  readonly type: typeof T.COMPOUND_ASSIGNMENT;
  readonly targets: readonly Node[];
  readonly operator: string;
  readonly value: Node;
}

/**
 * Extension tag invocation; `args` is a single `nodeList` node and `contentArgs` are
 * the tag's body blocks, so traversal handles both slots specially.
 */
interface CallExtensionNode extends NodeBase {
  readonly type: typeof T.CALL_EXTENSION | typeof T.CALL_EXTENSION_ASYNC;
  readonly extName: string;
  readonly prop: string;
  readonly args: Node;
  readonly contentArgs: readonly Node[];
  readonly autoescape: boolean;
}

/** One `match` arm binding `pattern`, with an optional `guard` before `body`. */
interface WhenNode extends NodeBase {
  readonly type: typeof T.WHEN;
  readonly pattern: Node;
  readonly guard: Node | null;
  readonly body: Node;
}

/** Pattern-match dispatcher over `when` clauses, with an optional `default`. */
interface MatchNode extends NodeBase {
  readonly type: typeof T.MATCH;
  readonly expr: Node;
  readonly cases: readonly WhenNode[];
  readonly default: Node | null;
}

/**
 * Named slot payload passed to `render`/`component`; not a node itself, so traversal
 * must unwrap the `body` through the `SlotBlock` envelope.
 */
interface SlotBlock {
  readonly name: string;
  readonly params: readonly string[];
  readonly body: Node;
}

/** Template invocation with a default `body` plus named `providedSlots`. */
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
