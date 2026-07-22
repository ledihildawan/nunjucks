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
  scopeClosers: string;
  inBlock: boolean;
  undefinedMode: UndefinedMode;
  compiledLine: number;
  sourceMap: SourceMap;
  init: (tmplName: string | null, undefMode: UndefinedMode | undefined, src: string) => void;
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
  const def: ThisType<Compiler> & Record<string, unknown> = {
    name: 'Compiler',
    init: function (tmplName: string | null, undefMode: UndefinedMode | undefined, src: string) {
      this.templateName = tmplName;
      this.codebuf = [];
      this.lastId = 0;
      this.buffer = null;
      this.bufferStack = [];
      this.scopeClosers = '';
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
    pushBuffer: function () {
      const id = this.tmpid();
      this.bufferStack.push(this.buffer);
      this.buffer = id;
      this.emit(`let ${this.buffer} = "";`);
      return id;
    },
    popBuffer: function () {
      this.buffer = this.bufferStack.pop() as string | null;
    },
    emit: function (code: string) {
      this.codebuf.push(code);
    },
    emitLine: function (code: string, originalLine?: number) {
      this.compiledLine++;
      if (isNonNullish(originalLine)) {
        this.sourceMap.addMapping(this.compiledLine, originalLine);
      }
      this.emit(code + '\n');
    },
    emitLineWithMapping: function (code: string, templateLine?: number, templateCol?: number) {
      this.compiledLine++;
      if (templateLine !== undefined) {
        this.sourceMap.addMapping(this.compiledLine, templateLine, templateCol || 0);
      }
      this.emit(code + '\n');
    },
    trackMapping: function (templateLine?: number, templateCol?: number) {
      if (templateLine !== undefined) {
        this.sourceMap.addMapping(this.compiledLine, templateLine, templateCol || 0);
      }
    },
    emitLineWithLineno: function (code: string, templateLine?: number, templateCol?: number) {
      this.compiledLine++;
      if (templateLine !== undefined) {
        this.sourceMap.addMapping(this.compiledLine, templateLine, templateCol || 0);
      }
      this.emit(code + '\n');
    },
    emitLines: function (...lines: string[]) {
      lines.forEach((line) => this.emitLine(line));
    },
    emitFuncBegin: function (node: Node, name: string) {
      this.buffer = 'output';
      this.scopeClosers = '';
      this.emitLine(`async function ${name}(env, context, frame, runtime) {`);
      this.emitLineWithMapping(`let lineno = ${node.lineno};`, node.lineno, node.colno);
      this.emitLine(`let colno = ${node.colno != null ? node.colno : 0};`);
      this.emitLine(`let ${this.buffer} = "";`);
      this.emitLine('try {');
    },
    emitFuncEnd: function (noReturn?: boolean) {
      if (!noReturn) {
        this.emitLine(`return ${this.buffer};`);
      }

      this.closeScopeLevels();
      this.emitLine('} catch (e) {');
      this.emitLine('  throw runtime.handleError(e, lineno, colno, runtime);');
      this.emitLine('}');
      this.emitLine('}');
      this.buffer = null;
    },
    addScopeLevel: function () {
      this.scopeClosers += '})';
    },
    closeScopeLevels: function () {
      if (this.scopeClosers) {
        this.emitLine(this.scopeClosers + ';');
      }
      this.scopeClosers = '';
    },
    withScopedSyntax: function (func: () => void) {
      const savedScopeClosers = this.scopeClosers;
      this.scopeClosers = '';

      func.call(this);

      this.closeScopeLevels();
      this.scopeClosers = savedScopeClosers;
    },
    tmpid: function () {
      this.lastId++;
      return 't_' + this.lastId;
    },
    getTemplateName: function () {
      return this.templateName === null || this.templateName === undefined ? 'undefined' : JSON.stringify(this.templateName);
    },
    compileChildren: function (node: Node, frame?: Frame) {
      node.children!.forEach((child) => {
        this.compile(child, frame);
      });
    },
    compileExpression: function (node: Node, frame?: Frame) {
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
        // Check by constructor name
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
