
import { add, and, array, bitwiseAnd, bitwiseLShift, bitwiseNot, bitwiseOr, bitwiseRShift, bitwiseXor, caller, compare, concat, decrement, dict, div, floorDiv, funCall, getNodeTypeName, group, increment, inlineIf, is, literal, lookupVal, mod, mul, neg, nodeList, not, nullishCoalesce, optionalChain, or, pipe as pipeNode, pos, pow, slice, sub, symbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import type { Frame } from '@nunjucks/runtime';
import { compileDispatch } from './node-dispatch.ts';
import { DEFAULT_UNDEFINED_MODE, type UndefinedMode } from '@nunjucks/runtime/undefined';
import { createHtmlContextTracker, type HtmlContext } from '@nunjucks/shared';

/**
 * How `assertType` identifies an acceptable node kind: either the node type
 * name directly, or a node factory from `@nunjucks/nodes` matched by its
 * function name. Named here so the interface and the implementation share one
 * definition instead of restating `string | Function` at each site.
 */
export type NodeTypeMatcher = string | { readonly name: string };

export interface Compiler {
  templateName: string | null;
  codebuf: string[];
  lastId: number;
  buffer: string | null;
  bufferStack: Array<string | null>;
  scopeClosers: string;
  inBlock: boolean;
  undefinedMode: UndefinedMode;
  compiledLine: number;
  fail: (msg: string, lineno?: number, colno?: number) => void;
  pushBuffer: () => string;
  popBuffer: () => string | null;
  emit: (code: string) => void;
  emitLine: (code: string, originalLine?: number) => void;
  emitLineWithMapping: (code: string, templateLine?: number, templateCol?: number) => void;
  emitLines: (...lines: string[]) => void;
  emitFuncBegin: (node: Node, name: string) => void;
  emitFuncEnd: (noReturn?: boolean) => void;
  addScopeLevel: () => void;
  closeScopeLevels: () => void;
  withScopedSyntax: (func: () => void) => void;
  tmpid: () => string;
  getTemplateName: () => string;
  compileChildren: (node: Node, frame?: Frame) => void;
  compileExpression: (node: Node, frame?: Frame) => void;
  assertType: (node: Node, ...types: NodeTypeMatcher[]) => void;
  compile: (node: Node, frame?: Frame) => unknown;
  getCode: () => string;
  emtest: (code: string) => void;
  getHtmlContext: (lineno: number, colno: number) => HtmlContext;
}

export function createCompiler(
  _templateName: string | null,
  _undefinedMode: UndefinedMode | undefined,
  source: string
): Compiler {
  let templateName: string | null = _templateName;
  let undefinedMode: UndefinedMode | undefined = _undefinedMode;
  let codebuf: string[] = [];
  let lastId = 0;
  let buffer: string | null = null;
  let bufferStack: Array<string | null> = [];
  let scopeClosers = '';
  let inBlock = false;
  let compiledLine = 0;
  const contextTracker = createHtmlContextTracker(source);

  const fail = (msg: string, lineno?: number, colno?: number) => {
    let subject: string;
    if (typeof msg === 'string') {
      const lastPart = msg.split(':').pop();
      subject = (lastPart || 'compile').trim();
    } else {
      subject = 'compile';
    }
    const errorDef = ERROR_DEFINITIONS.WALK_UNKNOWN_TYPE;
    if (errorDef) {
      throw createLog('error',
        errorDef,
        { type: subject },
        subject,
        { lineno, colno, phase: 'compile', templateName, lineBase: 'zero' });
    }
    throw new Error(`unknown type: ${subject}`);
  };

  const pushBuffer = () => {
    const id = tmpid();
    bufferStack.push(buffer);
    buffer = id;
    emit(`let ${buffer} = "";`);
    return id;
  };

  const popBuffer = (): string | null => {
    buffer = bufferStack.pop() as string | null;
    return null;
  };

  const emit = (code: string) => {
    codebuf.push(code);
  };

  const emtest = (code: string) => {
    codebuf.push(code);
  };

  const emitLine = (code: string, _originalLine?: number) => {
    compiledLine += 1;
    emit(`${code}\n`);
  };

  const emitLineWithMapping = (code: string, templateLine?: number, _templateCol?: number) => {
    compiledLine += 1;
    if (templateLine !== undefined) {
      // Mapping tracked via templateLine but no longer maintained as a source map.
    }
    emit(`${code}\n`);
  };

  const emitLines = (...lines: string[]) => {
    for (const line of lines) {
      emitLine(line);
    }
  };

  const emitFuncBegin = (node: Node, name: string) => {
    buffer = 'output';
    scopeClosers = '';
    emitLineWithMapping(`async function ${name}(env, context, frame, runtime) {`, node.lineno, node.colno);
    emitLineWithMapping(`let lineno = ${node.lineno};`, node.lineno, node.colno);
    emitLine(`let colno = ${node.colno ?? 0};`);
    emitLine(`let ${buffer} = "";`);
    emitLine('try {');
  };

  const emitFuncEnd = (noReturn?: boolean) => {
    if (!noReturn) {
      emitLine(`return ${buffer};`);
    }

    closeScopeLevels();
    emitLine('} catch (e) {');
    emitLine('  throw runtime.handleError(e, lineno, colno, runtime);');
    emitLine('}');
    emitLine('}');
    buffer = null;
  };

  const addScopeLevel = () => {
    scopeClosers += '})';
  };

  const closeScopeLevels = () => {
    if (scopeClosers) {
      emitLine(`${scopeClosers};`);
    }
    scopeClosers = '';
  };

  const withScopedSyntax = (func: () => void) => {
    const savedScopeClosers = scopeClosers;
    scopeClosers = '';

    func();

    closeScopeLevels();
    scopeClosers = savedScopeClosers;
  };

  const tmpid = () => {
    lastId += 1;
    return `t_${lastId}`;
  };

  const getTemplateName = () => {
    if (templateName === null || templateName === undefined) {
      return 'undefined';
    }
    return JSON.stringify(templateName);
  };

  const compileChildren = (node: Node, frame?: Frame) => {
    for (const child of node.children ?? []) {
      compile(child, frame);
    }
  };

  const compileExpression = (node: Node, frame?: Frame) => {
    assertType(
      node,
      literal,
      symbol,
      group,
      array,
      dict,
      funCall,
      caller,
      pipeNode,
      lookupVal,
      compare,
      inlineIf,
      'in',
      is,
      and,
      or,
      not,
      add,
      concat,
      sub,
      mul,
      div,
      floorDiv,
      mod,
      pow,
      neg,
      pos,
      optionalChain,
      nullishCoalesce,
      nodeList,
      slice,
      bitwiseOr,
      bitwiseAnd,
      bitwiseXor,
      bitwiseLShift,
      bitwiseRShift,
      bitwiseNot,
      increment,
      decrement
    );
    compile(node, frame);
  };

  const assertType = (node: Node, ...types: NodeTypeMatcher[]) => {
    const typeName = getNodeTypeName(node);
    const matches = types.some(t => {
      if (typeof t === 'string') {
        return typeName === t;
      }
      if (t?.name && typeName === t.name) {
        return true;
      }
      if (t?.name) {
        const tName = t.name.toLowerCase();
        return typeName === tName;
      }
      return false;
    });
    if (!matches) {
      const err = new Error(`assertType: invalid type: ${typeName}`) as Error & Record<string, unknown>;
      err.code = 'ASSERT_TYPE_ERROR';
      err.subject = typeName;
      err.lineno = node.lineno ?? null;
      err.colno = node.colno ?? null;
      err.lineBase = 'zero';
      throw err;
    }
  };

  const compile = (node: Node, frame?: Frame) => compileDispatch(compiler, node, frame);

  const compiler: Compiler = {
    get templateName() { return templateName; },
    set templateName(v) { templateName = v; },
    get codebuf() { return codebuf; },
    set codebuf(v) { codebuf = v; },
    get lastId() { return lastId; },
    set lastId(v) { lastId = v; },
    get buffer() { return buffer; },
    set buffer(v) { buffer = v; },
    get bufferStack() { return bufferStack; },
    set bufferStack(v) { bufferStack = v; },
    get scopeClosers() { return scopeClosers; },
    set scopeClosers(v) { scopeClosers = v; },
    get inBlock() { return inBlock; },
    set inBlock(v) { inBlock = v; },
    get undefinedMode() { return undefinedMode || DEFAULT_UNDEFINED_MODE; },
    set undefinedMode(v) { undefinedMode = v; },
    get compiledLine() { return compiledLine; },
    set compiledLine(v) { compiledLine = v; },
    fail,
    pushBuffer,
    popBuffer,
    emit,
    emtest,
    emitLine,
    emitLineWithMapping,
    emitLines,
    emitFuncBegin,
    emitFuncEnd,
    addScopeLevel,
    closeScopeLevels,
    withScopedSyntax,
    tmpid,
    getTemplateName,
    compileChildren,
    compileExpression,
    assertType,
    compile,
    getCode: () => codebuf.join(''),
    getHtmlContext: (lineno: number, colno: number) => contextTracker.getContextAtLineCol(lineno, colno),
  };

  return compiler;
}