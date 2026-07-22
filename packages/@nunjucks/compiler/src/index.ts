import { pipe, filter, isDefined, isNonNullish, reduce } from 'remeda';
import { parse } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { add, and, array, bitwiseAnd, bitwiseLShift, bitwiseNot, bitwiseOr, bitwiseRShift, bitwiseXor, caller, compare, concat, decrement, dict, div, floorDiv, funCall, getNodeTypeName, group, increment, inlineIf, is, literal, lookupVal, mod, mul, neg, nodeList, not, nullishCoalesce, optionalChain, or, pipe as pipeNode, pos, pow, slice, sub, symbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import type { Frame } from '@nunjucks/runtime';
import { createSourceMap } from './source-map.ts';
import type { SourceMap } from './source-map.ts';
import { compileDispatch } from './node-dispatch.ts';
import { DEFAULT_UNDEFINED_MODE, getUndefinedMode, type UndefinedMode } from '@nunjucks/runtime/undefined';

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
  sourceMap: SourceMap;
  fail: (msg: string, lineno?: number, colno?: number) => void;
  pushBuffer: () => string;
  popBuffer: () => void;
  emit: (code: string) => void;
  emitLine: (code: string, originalLine?: number) => void;
  emitLineWithMapping: (code: string, templateLine?: number, templateCol?: number) => void;
  trackMapping: (templateLine?: number, templateCol?: number) => void;
  emitLineWithLineno: (code: string, templateLine?: number, templateCol?: number) => void;
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
  assertType: (node: Node, ...types: Array<string | Function>) => void;
  compile: (node: Node, frame?: Frame) => unknown;
  getCode: () => string;
  getSourceMap: () => SourceMap;
}

export function createCompiler(
  templateName: string | null,
  undefinedMode: UndefinedMode | undefined,
  source: string
): Compiler {
  let codebuf: string[] = [];
  let lastId = 0;
  let buffer: string | null = null;
  let bufferStack: Array<string | null> = [];
  let scopeClosers = '';
  let inBlock = false;
  let compiledLine = 0;
  const sourceMap = createSourceMap(templateName);

  const fail = (msg: string, lineno?: number, colno?: number) => {
    const subject = typeof msg === 'string' ? (msg.split(':').pop() || 'compile').trim() : 'compile';
    throw createLog('error',
      ERROR_DEFINITIONS.WALK_UNKNOWN_TYPE!,
      { type: subject },
      subject,
      { lineno, colno, phase: 'compile', templateName, lineBase: 'zero' });
  };

  const pushBuffer = () => {
    const id = tmpid();
    bufferStack.push(buffer);
    buffer = id;
    emit(`let ${buffer} = "";`);
    return id;
  };

  const popBuffer = () => {
    buffer = bufferStack.pop() as string | null;
  };

  const emit = (code: string) => {
    codebuf.push(code);
  };

  const emitLine = (code: string, originalLine?: number) => {
    compiledLine++;
    if (isNonNullish(originalLine)) {
      sourceMap.addMapping(compiledLine, originalLine);
    }
    emit(code + '\n');
  };

  const emitLineWithMapping = (code: string, templateLine?: number, templateCol?: number) => {
    compiledLine++;
    if (templateLine !== undefined) {
      sourceMap.addMapping(compiledLine, templateLine, templateCol || 0);
    }
    emit(code + '\n');
  };

  const trackMapping = (templateLine?: number, templateCol?: number) => {
    if (templateLine !== undefined) {
      sourceMap.addMapping(compiledLine, templateLine, templateCol || 0);
    }
  };

  const emitLineWithLineno = (code: string, templateLine?: number, templateCol?: number) => {
    compiledLine++;
    if (templateLine !== undefined) {
      sourceMap.addMapping(compiledLine, templateLine, templateCol || 0);
    }
    emit(code + '\n');
  };

  const emitLines = (...lines: string[]) => {
    lines.forEach((line) => emitLine(line));
  };

  const emitFuncBegin = (node: Node, name: string) => {
    buffer = 'output';
    scopeClosers = '';
    emitLine(`async function ${name}(env, context, frame, runtime) {`);
    emitLineWithMapping(`let lineno = ${node.lineno};`, node.lineno, node.colno);
    emitLine(`let colno = ${node.colno != null ? node.colno : 0};`);
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
      emitLine(scopeClosers + ';');
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
    lastId++;
    return 't_' + lastId;
  };

  const getTemplateName = () => {
    return templateName === null || templateName === undefined ? 'undefined' : JSON.stringify(templateName);
  };

  const compileChildren = (node: Node, frame?: Frame) => {
    node.children!.forEach((child) => {
      compile(child, frame);
    });
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
      compare,
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

  const assertType = (node: Node, ...types: Array<string | Function>) => {
    const typeName = getNodeTypeName(node);
    const matches = types.some(t => {
      if (typeof t === 'string') {
        return typeName === t;
      }
      if (t && t.name && typeName === t.name) {
        return true;
      }
      if (t && t.name) {
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

  const compile = (node: Node, frame?: Frame) => {
    return compileDispatch(compiler, node, frame);
  };

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
    get sourceMap() { return sourceMap; },
    fail,
    pushBuffer,
    popBuffer,
    emit,
    emitLine,
    emitLineWithMapping,
    trackMapping,
    emitLineWithLineno,
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
    getSourceMap: () => sourceMap,
  };

  return compiler;
}

export function getSourceMap(compiler: Compiler): SourceMap {
  return compiler.sourceMap;
}

export function getSourceMapFromCompile(
  src: string,
  asyncPipes: string[],
  extensions: Parameters<typeof parse>[1],
  name: string | null,
  opts: Parameters<typeof parse>[2] = {}
): SourceMap {
  const undefinedMode = getUndefinedMode(opts as { undefined?: unknown });
  const c = createCompiler(name, undefinedMode, src);

  const processedSrc = pipe(
    extensions || [],
    exts => exts.map(ext => ext.preprocess),
    comps => filter(comps, isDefined),
    processors => reduce(processors as Array<(src: string) => string>, (s, processor) => processor(s), src)
  );

  c.compile(
    (transform as (ast: Node, asyncPipes: string[], templateName?: string | null) => Node)(
      parse(processedSrc, extensions, opts),
      asyncPipes,
      name,
    ),
  );

  return c.getSourceMap();
}
