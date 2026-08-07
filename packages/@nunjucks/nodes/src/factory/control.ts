import type { Node, CaptureNode, MatchNode, WhenNode, RenderNode, SlotBlock, CallExtensionNode } from '../types/index.ts';
import { T, createNode } from './internal.ts';
import { nodeList } from './atomic.ts';

interface InlineIfFields {
  cond?: Node;
  body?: Node;
  else_?: Node | null;
}

const block = (lineno: number, colno: number, name?: string, body?: Node) =>
  createNode(T.BLOCK, lineno, colno, { name, body });

const ifNode = (lineno: number, colno: number, fields: InlineIfFields = {}) =>
  createNode(T.IF, lineno, colno, { else_: null, ...fields });

const inlineIf = (lineno: number, colno: number, fields: InlineIfFields = {}) =>
  createNode(T.INLINE_IF, lineno, colno, { else_: null, ...fields });

interface ForFields {
  arr?: Node;
  name?: Node;
  body?: Node;
  else_?: Node | null;
}

const forNode = (lineno: number, colno: number, fields: ForFields = {}) =>
  createNode(T.FOR, lineno, colno, { else_: null, ...fields });

interface ComponentFields {
  name: string;
  args?: readonly Node[];
  body?: Node;
  fallbackSlots?: SlotBlock[];
}

const component = (lineno: number, colno: number, fields: ComponentFields) =>
  createNode(T.COMPONENT, lineno, colno, { args: [], fallbackSlots: [], ...fields });

interface ImportFields {
  template: Node | string;
  target: string;
  withContext?: boolean;
}

const importNode = (lineno: number, colno: number, fields: ImportFields) =>
  createNode(T.IMPORT, lineno, colno, { withContext: false, ...fields });

interface FromImportFields {
  template: Node | string;
  names?: Node;
  withContext?: boolean;
}

const fromImportNode = (lineno: number, colno: number, fields: FromImportFields) =>
  createNode(T.FROM_IMPORT, lineno, colno, {
    withContext: false,
    ...fields,
    names: fields.names ?? nodeList(0, 0),
  });

const capture = (lineno: number, colno: number, body: Node, name: string | null = null): CaptureNode =>
  createNode(T.CAPTURE, lineno, colno, { body, name });

const execNode = (lineno: number, colno: number, expr: Node) =>
  createNode(T.EXEC, lineno, colno, { expr });

const scopeNode = (lineno: number, colno: number, assignments: readonly Node[] = [], body: Node | null = null) =>
  createNode(T.SCOPE, lineno, colno, { assignments, body });

interface SwitchFields {
  expr: Node;
  cases?: Node[];
  default_?: Node | null;
}

const switchNode = (lineno: number, colno: number, fields: SwitchFields) =>
  createNode(T.SWITCH, lineno, colno, {
    expr: fields.expr,
    cases: fields.cases ?? [],
    default: fields.default_ ?? null,
  });

const caseNode = (lineno: number, colno: number, cond: Node, body: Node) =>
  createNode(T.CASE, lineno, colno, { cond, body });

const extendsNode = (lineno: number, colno: number, template?: Node) =>
  createNode(T.EXTENDS, lineno, colno, { template });

const include = (lineno: number, colno: number, template?: Node, ignoreMissing: boolean | null = null) =>
  createNode(T.INCLUDE, lineno, colno, { template, ignoreMissing });

const superNode = (lineno: number, colno: number, blockName: string, sym: Node | null = null) =>
  createNode(T.SUPER, lineno, colno, { blockName, symbol: sym });

interface MatchFields {
  expr: Node;
  cases?: WhenNode[];
  default?: Node | null;
}

const match = (lineno: number, colno: number, fields: MatchFields): MatchNode =>
  createNode(T.MATCH, lineno, colno, { cases: [], default: null, ...fields });

const when = (lineno: number, colno: number, pattern: Node, body: Node, guard: Node | null = null): WhenNode =>
  createNode(T.WHEN, lineno, colno, { pattern, guard, body });

interface RenderFields {
  callExpr: Node;
  body: Node;
  providedSlots?: SlotBlock[];
}

const renderNode = (lineno: number, colno: number, fields: RenderFields): RenderNode =>
  createNode(T.RENDER, lineno, colno, { providedSlots: [], ...fields });

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
  lineno: number,
  colno: number,
  { ext, prop, args, contentArgs }: CallExtensionFields
): CallExtensionNode => {
  const extObj = extensionMetadata(ext);
  return createNode(type, lineno, colno, {
    extName: extensionName(ext, extObj),
    prop,
    args: args ?? nodeList(0, 0),
    contentArgs: contentArgs ?? [],
    autoescape: extObj.autoescape ?? true,
  });
};

const callExtension = (lineno: number, colno: number, fields: CallExtensionFields): CallExtensionNode =>
  buildCallExtension(T.CALL_EXTENSION, lineno, colno, fields);

const callExtensionAsync = (lineno: number, colno: number, fields: CallExtensionFields): CallExtensionNode =>
  buildCallExtension(T.CALL_EXTENSION_ASYNC, lineno, colno, fields);

export {
  block, ifNode, inlineIf, forNode,
  component, importNode, fromImportNode,
  capture, execNode, scopeNode,
  switchNode, caseNode, extendsNode, include, superNode,
  match, when, renderNode,
  callExtension, callExtensionAsync,
};
export type { InlineIfFields, ForFields, ComponentFields, ImportFields, FromImportFields, SwitchFields, MatchFields, RenderFields, CallExtensionFields };
