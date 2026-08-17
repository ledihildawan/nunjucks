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
import { nodeList } from './atomic.ts';
import { createNode, T } from './create-node.ts';

interface InlineIfFields {
  cond?: Node;
  body?: Node;
  alternate?: Node | null;
}

interface BlockFields {
  name?: string;
  body?: Node;
}

const block = (loc: Loc, fields: BlockFields = {}) => createNode(T.BLOCK, loc, { ...fields });

const ifNode = (loc: Loc, fields: InlineIfFields = {}) =>
  createNode(T.IF, loc, { alternate: null, ...fields });

const inlineIf = (loc: Loc, fields: InlineIfFields = {}) =>
  createNode(T.INLINE_IF, loc, { alternate: null, ...fields });

interface ForFields {
  arr?: Node;
  name?: Node;
  body?: Node;
  alternate?: Node | null;
}

const forNode = (loc: Loc, fields: ForFields = {}) =>
  createNode(T.FOR, loc, { alternate: null, ...fields });

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

interface CaptureFields {
  body: Node;
  name?: string | null;
}

const capture = (loc: Loc, fields: CaptureFields): CaptureNode =>
  createNode(T.CAPTURE, loc, { name: null, ...fields });

const execNode = (loc: Loc, expr: Node) => createNode(T.EXEC, loc, { expr });

interface ScopeFields {
  assignments?: readonly Node[];
  body?: Node | null;
}

const scopeNode = (loc: Loc, fields: ScopeFields = {}) =>
  createNode(T.SCOPE, loc, { assignments: [], body: null, ...fields });

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

interface IncludeFields {
  template?: Node;
  ignoreMissing?: boolean | null;
  only?: boolean;
  with?: Node;
}

const include = (loc: Loc, fields: IncludeFields = {}) =>
  createNode(T.INCLUDE, loc, { ignoreMissing: null, ...fields });

interface SuperFields {
  blockName: string;
  sym?: Node | null;
}

const superNode = (loc: Loc, fields: SuperFields) =>
  createNode(T.SUPER, loc, { blockName: fields.blockName, symbol: fields.sym ?? null });

interface MatchFields {
  expr: Node;
  cases?: WhenNode[];
  default?: Node | null;
}

const match = (loc: Loc, fields: MatchFields): MatchNode =>
  createNode(T.MATCH, loc, { cases: [], default: null, ...fields });

interface WhenFields {
  pattern: Node;
  body: Node;
  guard?: Node | null;
}

const when = (loc: Loc, fields: WhenFields): WhenNode =>
  createNode(T.WHEN, loc, {
    pattern: fields.pattern,
    guard: fields.guard ?? null,
    body: fields.body,
  });

interface RenderFields {
  callExpr: Node;
  body: Node;
  providedSlots?: SlotBlock[];
}

const renderNode = (loc: Loc, fields: RenderFields): RenderNode =>
  createNode(T.RENDER, loc, { providedSlots: [], ...fields });

interface ExtensionMetadata {
  extensionName?: string;
  autoescape?: boolean;
}

const extensionMetadata = (ext: unknown): ExtensionMetadata => {
  if (ext !== null && typeof ext === 'object') {
    const { extensionName: rawName, autoescape: rawAutoescape } = ext as Record<
      string,
      unknown
    >;
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
