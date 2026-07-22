import { pipe, filter, isDefined, isNonNullish, reduce } from 'remeda';
import { parse } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { add, and, array, bitwiseAnd, bitwiseLShift, bitwiseNot, bitwiseOr, bitwiseRShift, bitwiseXor, caller, compare, concat, decrement, dict, div, floorDiv, funCall, getNodeTypeName, group, increment, inlineIf, is, literal, lookupVal, mod, mul, neg, nodeList, not, nullishCoalesce, optionalChain, or, pipe as pipeNode, pos, pow, slice, sub, symbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createObj } from '@nunjucks/shared';
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
  _scopeClosers: string;
  inBlock: boolean;
  undefinedMode: UndefinedMode;
  compiledLine: number;
  sourceMap: SourceMap;
  init: (tmplName: string | null, undefMode: UndefinedMode | undefined, src: string) => void;
  fail: (msg: string, lineno?: number, colno?: number) => void;
  _pushBuffer: () => string;
  _popBuffer: () => void;
  _emit: (code: string) => void;
  _emitLine: (code: string, originalLine?: number) => void;
  _emitLineWithMapping: (code: string, templateLine?: number, templateCol?: number) => void;
  _trackMapping: (templateLine?: number, templateCol?: number) => void;
  _emitLineWithLineno: (code: string, templateLine?: number, templateCol?: number) => void;
  _emitLines: (...lines: string[]) => void;
  _emitFuncBegin: (node: Node, name: string) => void;
  _emitFuncEnd: (noReturn?: boolean) => void;
  _addScopeLevel: () => void;
  _closeScopeLevels: () => void;
  _withScopedSyntax: (func: () => void) => void;
  _tmpid: () => string;
  _templateName: () => string;
  _compileChildren: (node: Node, frame?: Frame) => void;
  _compileExpression: (node: Node, frame?: Frame) => void;
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
  const def: ThisType<Compiler> & Record<string, unknown> = {
    name: 'Compiler',
    init: function (tmplName: string | null, undefMode: UndefinedMode | undefined, src: string) {
      this.templateName = tmplName;
      this.codebuf = [];
      this.lastId = 0;
      this.buffer = null;
      this.bufferStack = [];
      this._scopeClosers = '';
      this.inBlock = false;
      this.undefinedMode = undefMode || DEFAULT_UNDEFINED_MODE;
      this.compiledLine = 0;
      this.sourceMap = createSourceMap(tmplName);
    },
    fail: function (msg: string, lineno?: number, colno?: number) {
      const subject = typeof msg === 'string' ? (msg.split(':').pop() || 'compile').trim() : 'compile';
      throw createLog('error',
        ERROR_DEFINITIONS.WALK_UNKNOWN_TYPE!,
        { type: subject },
        subject,
        { lineno, colno, phase: 'compile', templateName: this.templateName, lineBase: 'zero' });
    },
    _pushBuffer: function () {
      const id = this._tmpid();
      this.bufferStack.push(this.buffer);
      this.buffer = id;
      this._emit(`let ${this.buffer} = "";`);
      return id;
    },
    _popBuffer: function () {
      this.buffer = this.bufferStack.pop() as string | null;
    },
    _emit: function (code: string) {
      this.codebuf.push(code);
    },
    _emitLine: function (code: string, originalLine?: number) {
      this.compiledLine++;
      if (isNonNullish(originalLine)) {
        this.sourceMap.addMapping(this.compiledLine, originalLine);
      }
      this._emit(code + '\n');
    },
    _emitLineWithMapping: function (code: string, templateLine?: number, templateCol?: number) {
      this.compiledLine++;
      if (templateLine !== undefined) {
        this.sourceMap.addMapping(this.compiledLine, templateLine, templateCol || 0);
      }
      this._emit(code + '\n');
    },
    _trackMapping: function (templateLine?: number, templateCol?: number) {
      if (templateLine !== undefined) {
        this.sourceMap.addMapping(this.compiledLine, templateLine, templateCol || 0);
      }
    },
    _emitLineWithLineno: function (code: string, templateLine?: number, templateCol?: number) {
      this.compiledLine++;
      if (templateLine !== undefined) {
        this.sourceMap.addMapping(this.compiledLine, templateLine, templateCol || 0);
      }
      this._emit(code + '\n');
    },
    _emitLines: function (...lines: string[]) {
      lines.forEach((line) => this._emitLine(line));
    },
    _emitFuncBegin: function (node: Node, name: string) {
      this.buffer = 'output';
      this._scopeClosers = '';
      this._emitLine(`async function ${name}(env, context, frame, runtime) {`);
      this._emitLineWithMapping(`let lineno = ${node.lineno};`, node.lineno, node.colno);
      this._emitLine(`let colno = ${node.colno != null ? node.colno : 0};`);
      this._emitLine(`let ${this.buffer} = "";`);
      this._emitLine('try {');
    },
    _emitFuncEnd: function (noReturn?: boolean) {
      if (!noReturn) {
        this._emitLine(`return ${this.buffer};`);
      }

      this._closeScopeLevels();
      this._emitLine('} catch (e) {');
      this._emitLine('  throw runtime.handleError(e, lineno, colno, runtime);');
      this._emitLine('}');
      this._emitLine('}');
      this.buffer = null;
    },
    _addScopeLevel: function () {
      this._scopeClosers += '})';
    },
    _closeScopeLevels: function () {
      if (this._scopeClosers) {
        this._emitLine(this._scopeClosers + ';');
      }
      this._scopeClosers = '';
    },
    _withScopedSyntax: function (func: () => void) {
      const _scopeClosers = this._scopeClosers;
      this._scopeClosers = '';

      func.call(this);

      this._closeScopeLevels();
      this._scopeClosers = _scopeClosers;
    },
    _tmpid: function () {
      this.lastId++;
      return 't_' + this.lastId;
    },
    _templateName: function () {
      return this.templateName === null || this.templateName === undefined ? 'undefined' : JSON.stringify(this.templateName);
    },
    _compileChildren: function (node: Node, frame?: Frame) {
      node.children!.forEach((child) => {
        this.compile(child, frame);
      });
    },
    _compileExpression: function (node: Node, frame?: Frame) {
      this.assertType(
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
      this.compile(node, frame);
    },
    assertType: function (node: Node, ...types: Array<string | Function>) {
      const typeName = getNodeTypeName(node);
      const matches = types.some(t => {
        if (typeof t === 'string') {
          return typeName === t;
        }
        // Check by constructor name (for backward compat with old pattern)
        if (t && t.name && typeName === t.name) {
          return true;
        }
        // Check by type function - use lowercase type name
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
    },
    compile: function (node: Node, frame?: Frame) {
      return compileDispatch(this, node, frame);
    },
    getCode: function () {
      return this.codebuf.join('');
    },
    getSourceMap: function () {
      return this.sourceMap;
    },
  };
  const obj = createObj(def) as unknown as Compiler;
  obj.init(templateName, undefinedMode, source);
  return obj;
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
