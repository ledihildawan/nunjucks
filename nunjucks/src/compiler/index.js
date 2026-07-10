import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
import {
  Literal,
  AstSymbol,
  Group,
  Array,
  Dict,
  FunCall,
  Caller,
  Pipe,
  LookupVal,
  Compare,
  InlineIf,
  In as OperatorIn,
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
import { TemplateError } from '../error/index.js';
import { Obj } from '../object/index.js';
import { SourceMap } from '../helpers/source-map.js';
import { COMPILE_FUNCTIONS, compileDispatch } from './node-dispatch.js';

export class Compiler extends Obj {
  init(templateName, throwOnUndefined, source) {
    this.templateName = templateName;
    this.codebuf = [];
    this.lastId = 0;
    this.buffer = null;
    this.bufferStack = [];
    this._scopeClosers = '';
    this.inBlock = false;
    this.throwOnUndefined = throwOnUndefined;
    this.compiledLine = 0;
    this.sourceMap = new SourceMap(templateName);
  }

  fail(msg, lineno, colno) {
    throw new TemplateError(msg, lineno, colno, { phase: 'compile', templateName: this.templateName });
  }

  _pushBuffer() {
    const id = this._tmpid();
    this.bufferStack.push(this.buffer);
    this.buffer = id;
    this._emit(`var ${this.buffer} = "";`);
    return id;
  }

  _popBuffer() {
    this.buffer = this.bufferStack.pop();
  }

  _emit(code) {
    this.codebuf.push(code);
  }

  _emitLine(code, originalLine) {
    this.compiledLine++;
    if (originalLine !== undefined && originalLine !== null) {
      this.sourceMap.addMapping(this.compiledLine, originalLine);
    }
    this._emit(code + '\n');
  }

  _emitLineWithMapping(code, templateLine, templateCol) {
    this.compiledLine++;
    if (templateLine !== undefined) {
      this.sourceMap.addMapping(this.compiledLine, templateLine + 1, templateCol || 0);
    }
    this._emit(code + '\n');
  }

  _trackMapping(templateLine, templateCol) {
    if (templateLine !== undefined) {
      this.sourceMap.addMapping(this.compiledLine + 1, templateLine + 1, templateCol || 0);
    }
  }

  _emitLineWithLineno(code, templateLine, templateCol) {
    this.compiledLine++;
    if (templateLine !== undefined) {
      this.sourceMap.addMapping(this.compiledLine, templateLine + 1, templateCol || 0);
    }
    this._emit(code + '\n');
  }

  _emitLines(...lines) {
    lines.forEach((line) => this._emitLine(line));
  }

  _emitFuncBegin(node, name) {
    this.buffer = 'output';
    this._scopeClosers = '';
    this._emitLine(`async function ${name}(env, context, frame, runtime) {`);
    this._emitLineWithMapping(`var lineno = ${node.lineno};`, node.lineno, node.colno);
    this._emitLine(`var colno = ${node.colno};`);
    this._emitLine(`var ${this.buffer} = "";`);
    this._emitLine('try {');
  }

  _emitFuncEnd(noReturn) {
    if (!noReturn) {
      this._emitLine(`return ${this.buffer};`);
    }

    this._closeScopeLevels();
    this._emitLine('} catch (e) {');
    this._emitLine('  throw runtime.handleError(e, lineno, colno);');
    this._emitLine('}');
    this._emitLine('}');
    this.buffer = null;
  }

  _addScopeLevel() {
    this._scopeClosers += '})';
  }

  _closeScopeLevels() {
    if (this._scopeClosers) {
      this._emitLine(this._scopeClosers + ';');
    }
    this._scopeClosers = '';
  }

  _withScopedSyntax(func) {
    const _scopeClosers = this._scopeClosers;
    this._scopeClosers = '';

    func.call(this);

    this._closeScopeLevels();
    this._scopeClosers = _scopeClosers;
  }

  _tmpid() {
    this.lastId++;
    return 't_' + this.lastId;
  }

  _templateName() {
    return this.templateName == null ? 'undefined' : JSON.stringify(this.templateName);
  }

  _compileChildren(node, frame) {
    node.children.forEach((child) => {
      this.compile(child, frame);
    });
  }

  _compileExpression(node, frame) {
    this.assertType(
      node,
      Literal,
      AstSymbol,
      Group,
      Array,
      Dict,
      FunCall,
      Caller,
      Pipe,
      LookupVal,
      Compare,
      InlineIf,
      OperatorIn,
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
  }

  assertType(node, ...types) {
    if (!types.some(t => node instanceof t)) {
      this.fail(`assertType: invalid type: ${node.typename}`, node.lineno, node.colno);
    }
  }

  compile(node, frame) {
    return compileDispatch(this, node, frame);
  }

  getCode() {
    return this.codebuf.join('');
  }

  getSourceMap() {
    return this.sourceMap;
  }
}

export function compile(src, asyncPipes, extensions, name, opts = {}) {
  const c = new Compiler(name, opts.throwOnUndefined, src);

  const preprocessors = (extensions || []).map(ext => ext.preprocess).filter(f => !!f);

  const processedSrc = preprocessors.reduce((s, processor) => processor(s), src);

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
  const c = new Compiler(name, opts.throwOnUndefined, src);

  const preprocessors = (extensions || []).map(ext => ext.preprocess).filter(f => !!f);

  const processedSrc = preprocessors.reduce((s, processor) => processor(s), src);

  c.compile(transform(
    parse(processedSrc, extensions, opts),
    asyncPipes,
    name
  ));

  return c.getSourceMap();
}
