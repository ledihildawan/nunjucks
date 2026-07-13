import { pipe, filter, isDefined, isNonNullish, reduce } from 'remeda';
import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
import { nodes } from '../nodes/index.js';
import { createTemplateError } from '../error/index.js';
import { createObj } from '../object/index.js';
import { createSourceMap } from '../helpers/source-map.js';
import { compileDispatch } from './node-dispatch.js';
import { DEFAULT_UNDEFINED_MODE, getUndefinedMode } from '../runtime/undefined.js';
import { compile as compileModern } from './code-gen.js';

export function createCompiler(templateName, undefinedMode, source) {
  const obj = createObj({
    name: 'Compiler',
    init: function(tmplName, undefMode, src) {
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
      if (isNonNullish(originalLine)) {
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
        nodes.literal,
        nodes.symbol,
        nodes.group,
        nodes.array,
        nodes.dict,
        nodes.funCall,
        nodes.caller,
        nodes.pipe,
        nodes.lookupVal,
        nodes.compare,
        nodes.inlineIf,
        nodes.in,
        nodes.is,
        nodes.and,
        nodes.or,
        nodes.not,
        nodes.add,
        nodes.concat,
        nodes.sub,
        nodes.mul,
        nodes.div,
        nodes.floorDiv,
        nodes.mod,
        nodes.pow,
        nodes.neg,
        nodes.pos,
        nodes.compare,
        nodes.optionalChain,
        nodes.nullishCoalesce,
        nodes.nodeList,
        nodes.slice
      );
      this.compile(node, frame);
    },
    assertType: function(node, ...types) {
      const typeName = nodes.getNodeTypeName(node);
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
  
  const modernOpts = {
    async: asyncPipes ? 'auto' : false,
    sourceMap: false,
    autoescape: opts.autoescape ?? true,
    trimBlocks: opts.trimBlocks ?? false,
    lstripBlocks: opts.lstripBlocks ?? false,
    undefined: undefinedMode,
  };

  try {
    const result = compileModern(src, extensions || [], extensions || [], name, modernOpts);
    if (typeof result === 'object' && result.code) {
      return result.code;
    }
    return result;
  } catch (e) {
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
