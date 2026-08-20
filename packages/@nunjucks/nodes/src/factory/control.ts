import type { Loc } from '@nunjucks/shared';
import { ZERO_LOC } from '@nunjucks/shared';
import type {
  CallExtensionNode,
  CaptureNode,
  MatchNode,
  Node,
  RenderNode,
  SlotBlock,
  WhenNode,
} from '../types/index.ts';
import { copy, nodeList } from './atomic.ts';
import { createNode, T } from './create-node.ts';

/** Fields for `if` and `inlineIf` nodes; `alternate` defaults to `null` when omitted. */
interface InlineIfFields {
  cond?: Node;
  body?: Node;
  alternate?: Node | null;
}

interface BlockFields {
  name?: string;
  body?: Node;
}

/** Creates a `block` node naming an overridable template region. */
const block = (loc: Loc, fields: BlockFields = {}) => createNode(T.BLOCK, loc, { ...fields });

/** Creates an `if` node; `alternate` is normalized to `null` when not supplied. */
const ifNode = (loc: Loc, fields: InlineIfFields = {}) =>
  createNode(T.IF, loc, { alternate: null, ...fields });

/** Creates an `inlineIf` node for `x if cond else y` expressions. */
const inlineIf = (loc: Loc, fields: InlineIfFields = {}) =>
  createNode(T.INLINE_IF, loc, { alternate: null, ...fields });

/** Fields for a `for` node; `alternate` defaults to `null` for the else branch. */
interface ForFields {
  arr?: Node;
  name?: Node;
  body?: Node;
  alternate?: Node | null;
}

/** Creates a `for` loop node with an optional `alternate` run on empty iterables. */
const forNode = (loc: Loc, fields: ForFields = {}) =>
  createNode(T.FOR, loc, { alternate: null, ...fields });

/** Fields for a `component` node; `args` and `fallbackSlots` default to empty. */
interface ComponentFields {
  name: string;
  args?: readonly Node[];
  body?: Node;
  fallbackSlots?: SlotBlock[];
}

// WHY: child arrays (args, fallbackSlots, cases, providedSlots, contentArgs) go through
// copy() — the node owns its children; caller-array mutation must not reach the node.
/** Creates a `component` node invoking a template as a custom tag with slot content. */
const component = (loc: Loc, { args, fallbackSlots, ...rest }: ComponentFields) =>
  createNode(T.COMPONENT, loc, { ...rest, args: copy(args), fallbackSlots: copy(fallbackSlots) });

/** Fields for an `import` node; `withContext` defaults to `false`. */
interface ImportFields {
  template: Node | string;
  target: string;
  withContext?: boolean;
}

/** Creates an `import` node loading a template's exports under a name. */
const importNode = (loc: Loc, fields: ImportFields) =>
  createNode(T.IMPORT, loc, { withContext: false, ...fields });

/** Fields for a `fromImport` node; `names` defaults to an empty `nodeList`. */
interface FromImportFields {
  template: Node | string;
  names?: Node;
  withContext?: boolean;
}

const fromImportNode = (loc: Loc, fields: FromImportFields) =>
  createNode(T.FROM_IMPORT, loc, {
    withContext: false,
    ...fields,
    names: fields.names ?? nodeList(ZERO_LOC),
  });

/** Fields for a `capture` node; `name` defaults to `null` for anonymous captures. */
interface CaptureFields {
  body: Node;
  name?: string | null;
}

/** Creates a `capture` node rendering its body to a string instead of output. */
const capture = (loc: Loc, fields: CaptureFields): CaptureNode =>
  createNode(T.CAPTURE, loc, { name: null, ...fields });

/** Creates an `exec` node running an expression purely for its side effects. */
const execNode = (loc: Loc, expr: Node) => createNode(T.EXEC, loc, { expr });

/** Fields for a `scope` node; `assignments` and `body` default to empty/null. */
interface ScopeFields {
  assignments?: readonly Node[];
  body?: Node | null;
}

/** Creates a `scope` node exposing `pair` assignments to its body only. */
const scopeNode = (loc: Loc, fields: ScopeFields = {}) =>
  createNode(T.SCOPE, loc, { assignments: [], body: null, ...fields });

/** Fields for a `switch` node; `cases` and `default_` default to empty/null. */
interface SwitchFields {
  expr: Node;
  cases?: Node[];
  default_?: Node | null;
}

/** Creates a `switch` node dispatching on `expr` across `case` children. */
const switchNode = (loc: Loc, fields: SwitchFields) =>
  createNode(T.SWITCH, loc, {
    expr: fields.expr,
    cases: copy(fields.cases),
    default: fields.default_ ?? null,
  });

/** Fields for a `case` clause node. */
interface CaseFields {
  cond: Node;
  body: Node;
}

const caseNode = (loc: Loc, fields: CaseFields) => createNode(T.CASE, loc, { ...fields });

interface ExtendsFields {
  template: Node;
}

const extendsNode = (loc: Loc, fields: ExtendsFields) =>
  createNode(T.EXTENDS, loc, { template: fields.template });

/** Fields for an `include` node; `ignoreMissing` defaults to `null`. */
interface IncludeFields {
  template?: Node;
  ignoreMissing?: boolean | null;
  only?: boolean;
  with?: Node;
}

/** Creates an `include` node inlining another template's rendered output. */
const include = (loc: Loc, fields: IncludeFields = {}) =>
  createNode(T.INCLUDE, loc, { ignoreMissing: null, ...fields });

/** Fields for a `super` node; `sym` defaults to `null`. */
interface SuperFields {
  blockName: string;
  sym?: Node | null;
}

/** Creates a `super` node rendering the parent template's overridden block. */
const superNode = (loc: Loc, fields: SuperFields) =>
  createNode(T.SUPER, loc, { blockName: fields.blockName, symbol: fields.sym ?? null });

/** Fields for a `match` node; `cases` and `default` default to empty/null. */
interface MatchFields {
  expr: Node;
  cases?: WhenNode[];
  default?: Node | null;
}

/** Creates a `match` node dispatching on `expr` across `when` clauses. */
const match = (loc: Loc, { cases, ...rest }: MatchFields): MatchNode =>
  createNode(T.MATCH, loc, { ...rest, cases: copy(cases), default: rest.default ?? null });

/** Fields for a `when` clause node; `guard` defaults to `null`. */
interface WhenFields {
  pattern: Node;
  body: Node;
  guard?: Node | null;
}

/** Creates a `when` clause node binding a `match` pattern, with optional guard. */
const when = (loc: Loc, fields: WhenFields): WhenNode =>
  createNode(T.WHEN, loc, {
    pattern: fields.pattern,
    guard: fields.guard ?? null,
    body: fields.body,
  });

/** Fields for a `render` node; `providedSlots` defaults to empty. */
interface RenderFields {
  callExpr: Node;
  body: Node;
  providedSlots?: SlotBlock[];
}

/** Creates a `render` node invoking a template with a default body and named slots. */
const renderNode = (loc: Loc, { providedSlots, ...rest }: RenderFields): RenderNode =>
  createNode(T.RENDER, loc, { ...rest, providedSlots: copy(providedSlots) });

interface ExtensionMetadata {
  extensionName?: string;
  autoescape?: boolean;
}

const extensionMetadata = (ext: unknown): ExtensionMetadata => {
  if (ext !== null && typeof ext === 'object') {
    const { extensionName: rawName, autoescape: rawAutoescape } = ext as Record<string, unknown>;
    return {
      extensionName: typeof rawName === 'string' ? rawName : undefined,
      autoescape: typeof rawAutoescape === 'boolean' ? rawAutoescape : undefined,
    };
  }
  return {};
};

const extensionName = (ext: unknown, metadata: ExtensionMetadata): string => {
  if (metadata.extensionName) {
    return metadata.extensionName;
  }
  if (typeof ext === 'string') {
    return ext;
  }
  return '';
};

/** Fields for extension call nodes; `args`/`contentArgs` default to empty. */
interface CallExtensionFields {
  ext: unknown;
  prop: string;
  args?: Node;
  contentArgs?: Node[];
}

const buildCallExtension = (
  type: typeof T.CALL_EXTENSION | typeof T.CALL_EXTENSION_ASYNC,
  loc: Loc,
  { ext, prop, args, contentArgs }: CallExtensionFields
): CallExtensionNode => {
  const extObj = extensionMetadata(ext);
  return createNode(type, loc, {
    extName: extensionName(ext, extObj),
    prop,
    args: args ?? nodeList(ZERO_LOC),
    contentArgs: copy(contentArgs),
    autoescape: extObj.autoescape ?? true,
  });
};

/** Creates a synchronous extension call node, normalizing `ext` metadata and defaults. */
const callExtension = (loc: Loc, fields: CallExtensionFields): CallExtensionNode =>
  buildCallExtension(T.CALL_EXTENSION, loc, fields);

// WHY: extension-author surface — async extension tags (custom tags registered with an
// async parse/run contract) build this variant so the compiler can emit the awaited
// call path; symmetric with callExtension by design.
const callExtensionAsync = (loc: Loc, fields: CallExtensionFields): CallExtensionNode =>
  buildCallExtension(T.CALL_EXTENSION_ASYNC, loc, fields);

export type {
  BlockFields,
  CallExtensionFields,
  CaptureFields,
  CaseFields,
  ComponentFields,
  ExtendsFields,
  ForFields,
  FromImportFields,
  ImportFields,
  IncludeFields,
  InlineIfFields,
  MatchFields,
  RenderFields,
  ScopeFields,
  SuperFields,
  SwitchFields,
  WhenFields,
};
export {
  block,
  callExtension,
  callExtensionAsync,
  capture,
  caseNode,
  component,
  execNode,
  extendsNode,
  forNode,
  fromImportNode,
  ifNode,
  importNode,
  include,
  inlineIf,
  match,
  renderNode,
  scopeNode,
  superNode,
  switchNode,
  when,
};
