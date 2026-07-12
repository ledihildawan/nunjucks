import { pipe, filter, isDefined, reduce } from 'remeda';
import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
import { getNodeTypeName } from '../nodes/index.js';
import {
  Literal,
  AstSymbol,
  Group,
  ArrayNode,
  Dict,
  FunCall,
  Caller,
  Pipe,
  LookupVal,
  Compare,
  InlineIf,
  In,
  Is,
  And,
  Or,
  Not,
  Add,
  Concat,
  Sub,
  Mul,
  Div,
  FloorDiv,
  Mod,
  Pow,
  Neg,
  Pos,
  OptionalChain,
  NullishCoalesce,
  NodeList,
  Slice,
} from '../nodes/index.js';
import { createTemplateError } from '../error/index.js';
import { createObj } from '../object/index.js';
import { createSourceMap } from '../helpers/source-map.js';
import { COMPILE_FUNCTIONS, compileDispatch } from './node-dispatch.js';
import { DEFAULT_UNDEFINED_MODE, getUndefinedMode } from '../runtime/undefined.js';

export function createCompiler(templateName, undefinedMode, source) {
  const obj = createObj({
    name: 'Compiler',
    init: function(templateName, undefinedMode, source) {
      this.templateName = templateName;
      this.codebuf = [];
      this.lastId = 0;
      this.buffer = null;
      this.bufferStack = [];
      this._scopeClosers = '';
      this.inBlock = false;
      this.undefinedMode = undefinedMode || DEFAULT_UNDEFINED_MODE;
      this.compiledLine = 0;
      this.sourceMap = createSourceMap(templateName);
    },
    fail: function(msg, lineno, colno) {
      throw createTemplateError(msg, lineno, colno, { phase: 'compile', templateName: this.templateName });
    },
    _pushBuffer: function() {
      const id = this._tmpid();
      this.bufferStack.push(this.buffer);
      this.buffer = id;
      this._emit(`var ${this.buffer} = "";`);
      return id;
    },
    _popBuffer: function() {
      this.buffer = this.bufferStack.pop();
    },
    _emit: function(code) {
      this.codebuf.push(code);
    },
    _emitLine: function(code, originalLine) {
      this.compiledLine++;
      if (originalLine !== undefined && originalLine !== null) {
        this.sourceMap.addMapping(this.compiledLine, originalLine);
      }
      this._emit(code + '\n');
    },
    _emitLineWithMapping: function(code, templateLine, templateCol) {
      this.compiledLine++;
      if (templateLine !== undefined) {
        this.sourceMap.addMapping(this.compiledLine, templateLine + 1, templateCol || 0);
      }
      this._emit(code + '\n');
    },
    _trackMapping: function(templateLine, templateCol) {
      if (templateLine !== undefined) {
        this.sourceMap.addMapping(this.compiledLine + 1, templateLine + 1, templateCol || 0);
      }
    },
    _emitLineWithLineno: function(code, templateLine, templateCol) {
      this.compiledLine++;
      if (templateLine !== undefined) {
        this.sourceMap.addMapping(this.compiledLine, templateLine + 1, templateCol || 0);
      }
      this._emit(code + '\n');
    },
    _emitLines: function(...lines) {
      lines.forEach((line) => this._emitLine(line));
    },
    _emitFuncBegin: function(node, name) {
      this.buffer = 'output';
      this._scopeClosers = '';
      this._emitLine(`async function ${name}(env, context, frame, runtime) {`);
      this._emitLineWithMapping(`var lineno = ${node.lineno};`, node.lineno, node.colno);
      this._emitLine(`var colno = ${node.colno};`);
      this._emitLine(`var ${this.buffer} = "";`);
      this._emitLine('try {');
    },
    _emitFuncEnd: function(noReturn) {
      if (!noReturn) {
        this._emitLine(`return ${this.buffer};`);
      }

      this._closeScopeLevels();
      this._emitLine('} catch (e) {');
      this._emitLine('  throw runtime.handleError(e, lineno, colno);');
      this._emitLine('}');
      this._emitLine('}');
      this.buffer = null;
    },
    _addScopeLevel: function() {
      this._scopeClosers += '})';
    },
    _closeScopeLevels: function() {
      if (this._scopeClosers) {
        this._emitLine(this._scopeClosers + ';');
      }
      this._scopeClosers = '';
    },
    _withScopedSyntax: function(func) {
      const _scopeClosers = this._scopeClosers;
      this._scopeClosers = '';

      func.call(this);

      this._closeScopeLevels();
      this._scopeClosers = _scopeClosers;
    },
    _tmpid: function() {
      this.lastId++;
      return 't_' + this.lastId;
    },
    _templateName: function() {
      return this.templateName === null || this.templateName === undefined ? 'undefined' : JSON.stringify(this.templateName);
    },
    _compileChildren: function(node, frame) {
      node.children.forEach((child) => {
        this.compile(child, frame);
      });
    },
    _compileExpression: function(node, frame) {
      this.assertType(
        node,
        Literal,
        AstSymbol,
        Group,
        ArrayNode,
        Dict,
        FunCall,
        Caller,
        Pipe,
        LookupVal,
        Compare,
        InlineIf,
        In,
        Is,
        And,
        Or,
        Not,
        Add,
        Concat,
        Sub,
        Mul,
        Div,
        FloorDiv,
        Mod,
        Pow,
        Neg,
        Pos,
        Compare,
        OptionalChain,
        NullishCoalesce,
        NodeList,
        Slice
      );
      this.compile(node, frame);
    },
    assertType: function(node, ...types) {
      const typeName = getNodeTypeName(node);
      const matches = types.some(t => {
        if (typeof t === 'string') {
          return typeName === t;
        }
        // Check by constructor
        if (t && t.name && typeName === t.name) {
          return true;
        }
        // Check via prototype chain
        if (node instanceof t) {
          return true;
        }
        return false;
      });
      if (!matches) {
        this.fail(`assertType: invalid type: ${typeName}`, node.lineno, node.colno);
      }
    },
    compile: function(node, frame) {
      return compileDispatch(this, node, frame);
    },
    getCode: function() {
      return this.codebuf.join('');
    },
    getSourceMap: function() {
      return this.sourceMap;
    },
  });
  obj.init(templateName, undefinedMode, source);
  return obj;
}

export function compile(src, asyncPipes, extensions, name, opts = {}) {
  const undefinedMode = getUndefinedMode(opts);
  const c = createCompiler(name, undefinedMode, src);

  const processedSrc = pipe(
    extensions || [],
    exts => exts.map(ext => ext.preprocess),
    comps => filter(comps, isDefined),
    processors => reduce(processors, (s, processor) => processor(s), src)
  );

  c.compile(transform(
    parse(processedSrc, extensions, opts),
    asyncPipes,
    name
  ));
  return c.getCode();
}

export function getSourceMap(compiler) {
  return compiler.sourceMap;
}

export function getSourceMapFromCompile(src, asyncPipes, extensions, name, opts = {}) {
  const undefinedMode = getUndefinedMode(opts);
  const c = createCompiler(name, undefinedMode, src);

  const processedSrc = pipe(
    extensions || [],
    exts => exts.map(ext => ext.preprocess),
    comps => filter(comps, isDefined),
    processors => reduce(processors, (s, processor) => processor(s), src)
  );

  c.compile(transform(
    parse(processedSrc, extensions, opts),
    asyncPipes,
    name
  ));

  return c.getSourceMap();
}
