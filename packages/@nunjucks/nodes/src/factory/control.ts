import type { Node, CaptureNode, MatchNode, WhenNode, RenderNode, SlotBlock, CallExtensionNode } from '../types/index.ts';
import type { Loc } from '@nunjucks/shared';
import { ZERO_LOC } from '@nunjucks/shared';
import { T, createNode } from './internal.ts';
import { nodeList } from './atomic.ts';

interface InlineIfFields {
  cond?: Node;
  body?: Node;
  else_?: Node | null;
}

const block = (loc: Loc, name?: string, body?: Node) =>
  createNode(T.BLOCK, loc, { name, body });

const ifNode = (loc: Loc, fields: InlineIfFields = {}) =>
  createNode(T.IF, loc, { else_: null, ...fields });

const inlineIf = (loc: Loc, fields: InlineIfFields = {}) =>
  createNode(T.INLINE_IF, loc, { else_: null, ...fields });

interface ForFields {
  arr?: Node;
  name?: Node;
  body?: Node;
  else_?: Node | null;
}

const forNode = (loc: Loc, fields: ForFields = {}) =>
  createNode(T.FOR, loc, { else_: null, ...fields });

interface ComponentFields {
  name: string;
  args?: readonly Node[];
  body?: Node;
  fallbackSlots?: SlotBlock[];
}

const component = (loc: Loc, fields: ComponentFields) =>
  createNode(T.COMPONENT, loc, { args: [], fallbackSlots: [], ...fields });

interface ImportFields {
  template: Node | string;
  target: string;
  withContext?: boolean;
}

const importNode = (loc: Loc, fields: ImportFields) =>
  createNode(T.IMPORT, loc, { withContext: false, ...fields });

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

const capture = (loc: Loc, body: Node, name: string | null = null): CaptureNode =>
  createNode(T.CAPTURE, loc, { body, name });

const execNode = (loc: Loc, expr: Node) =>
  createNode(T.EXEC, loc, { expr });

const scopeNode = (loc: Loc, assignments: readonly Node[] = [], body: Node | null = null) =>
  createNode(T.SCOPE, loc, { assignments, body });

interface SwitchFields {
  expr: Node;
  cases?: Node[];
  default_?: Node | null;
}

const switchNode = (loc: Loc, fields: SwitchFields) =>
  createNode(T.SWITCH, loc, {
    expr: fields.expr,
    cases: fields.cases ?? [],
    default: fields.default_ ?? null,
  });

const caseNode = (loc: Loc, cond: Node, body: Node) =>
  createNode(T.CASE, loc, { cond, body });

const extendsNode = (loc: Loc, template?: Node) =>
  createNode(T.EXTENDS, loc, { template });

const include = (loc: Loc, template?: Node, ignoreMissing: boolean | null = null) =>
  createNode(T.INCLUDE, loc, { template, ignoreMissing });

const superNode = (loc: Loc, blockName: string, sym: Node | null = null) =>
  createNode(T.SUPER, loc, { blockName, symbol: sym });

interface MatchFields {
  expr: Node;
  cases?: WhenNode[];
  default?: Node | null;
}

const match = (loc: Loc, fields: MatchFields): MatchNode =>
  createNode(T.MATCH, loc, { cases: [], default: null, ...fields });

const when = (loc: Loc, pattern: Node, body: Node, guard: Node | null = null): WhenNode =>
  createNode(T.WHEN, loc, { pattern, guard, body });

interface RenderFields {
  callExpr: Node;
  body: Node;
  providedSlots?: SlotBlock[];
}

const renderNode = (loc: Loc, fields: RenderFields): RenderNode =>
  createNode(T.RENDER, loc, { providedSlots: [], ...fields });

interface ExtensionMetadata {
  __name?: string;
  autoescape?: boolean;
}

const extensionMetadata = (ext: unknown): ExtensionMetadata => {
  if (ext !== null && typeof ext === 'object') {
    return ext as ExtensionMetadata;
  }
  return {};
};

const extensionName = (ext: unknown, metadata: ExtensionMetadata): string => {
  if (metadata.__name) {
    return metadata.__name;
  }
  if (typeof ext === 'string') {
    return ext;
  }
  return '';
};

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
    contentArgs: contentArgs ?? [],
    autoescape: extObj.autoescape ?? true,
  });
};

const callExtension = (loc: Loc, fields: CallExtensionFields): CallExtensionNode =>
  buildCallExtension(T.CALL_EXTENSION, loc, fields);

const callExtensionAsync = (loc: Loc, fields: CallExtensionFields): CallExtensionNode =>
  buildCallExtension(T.CALL_EXTENSION_ASYNC, loc, fields);

export {
  block, ifNode, inlineIf, forNode,
  component, importNode, fromImportNode,
  capture, execNode, scopeNode,
  switchNode, caseNode, extendsNode, include, superNode,
  match, when, renderNode,
  callExtension, callExtensionAsync,
};
export type { InlineIfFields, ForFields, ComponentFields, ImportFields, FromImportFields, SwitchFields, MatchFields, RenderFields, CallExtensionFields };
