import { parse } from './parser.js';
import { transform } from './transformer.js';
import * as nodes from './nodes.js';
import { TemplateError } from './lib.js';
import { Frame } from './runtime.js';
import { Obj } from './object.js';
import { SourceMap } from './source-map.js';

const compareOps = {
  '==': '==',
  '===': '===',
  '!=': '!=',
  '!==': '!==',
  '<': '<',
  '>': '>',
  '<=': '<=',
  '>=': '>='
};

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
    if (lineno !== undefined) {
      lineno += 1;
    }
    if (colno !== undefined) {
      colno += 1;
    }

    throw new TemplateError(msg, lineno, colno);
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
    var _scopeClosers = this._scopeClosers;
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

  _compileAggregate(node, frame, startChar, endChar) {
    if (startChar) {
      this._emit(startChar);
    }

    node.children.forEach((child, i) => {
      if (i > 0) {
        this._emit(',');
      }

      this.compile(child, frame);
    });

    if (endChar) {
      this._emit(endChar);
    }
  }

  _compileExpression(node, frame) {
    this.assertType(
      node,
      nodes.Literal,
      nodes.Symbol,
      nodes.Group,
      nodes.Array,
      nodes.Dict,
      nodes.FunCall,
      nodes.Caller,
      nodes.Pipe,
      nodes.LookupVal,
      nodes.Compare,
      nodes.InlineIf,
      nodes.In,
      nodes.Is,
      nodes.And,
      nodes.Or,
      nodes.Not,
      nodes.Add,
      nodes.Concat,
      nodes.Sub,
      nodes.Mul,
      nodes.Div,
      nodes.FloorDiv,
      nodes.Mod,
      nodes.Pow,
      nodes.Neg,
      nodes.Pos,
      nodes.Compare,
      nodes.OptionalChain,
      nodes.NullishCoalesce,
      nodes.NodeList,
      nodes.Slice
    );
    this.compile(node, frame);
  }

  assertType(node, ...types) {
    if (!types.some(t => node instanceof t)) {
      this.fail(`assertType: invalid type: ${node.typename}`, node.lineno, node.colno);
    }
  }

  compileCallExtension(node, frame, useAsync) {
    var args = node.args;
    var contentArgs = node.contentArgs;
    var autoescape = typeof node.autoescape === 'boolean' ? node.autoescape : true;

    if (contentArgs.length > 0) {
      useAsync = true;
    }

    const res = useAsync ? this._tmpid() : null;

    if (!useAsync) {
      this._emit(`${this.buffer} += runtime.suppressValue(`);
    }

    if (useAsync) {
      this._emit(`var ${res} = await env.getExtension("${node.extName}")["${node.prop}"](`);
    } else {
      this._emit(`env.getExtension("${node.extName}")["${node.prop}"](`);
    }

    this._emit('context');

    if (args || contentArgs) {
      this._emit(',');
    }

    if (args) {
      if (!(args instanceof nodes.NodeList)) {
        this.fail('compileCallExtension: arguments must be a NodeList, ' +
          'use `parser.parseSignature`');
      }

      args.children.forEach((arg, i) => {
        this._compileExpression(arg, frame);

        if (i !== args.children.length - 1 || contentArgs.length) {
          this._emit(',');
        }
      });
    }

    if (contentArgs.length) {
      contentArgs.forEach((arg, i) => {
        if (i > 0) {
          this._emit(',');
        }

        if (arg) {
          this._emitLine('async function() {');
          const id = this._pushBuffer();

          this.compile(arg, frame);

          this._popBuffer();
          this._emitLine('return ' + id + ';');
          this._emitLine('}');
        } else {
          this._emit('null');
        }
      });
    }

    if (useAsync) {
      this._emit(')');
      this._emitLine(
        `\n${this.buffer} += runtime.suppressValue(await ${res}, ${autoescape} && env.opts.autoescape);`);
    } else {
      this._emit(')');
      this._emit(`, ${autoescape} && env.opts.autoescape);\n`);
    }
  }

  compileCallExtensionAsync(node, frame) {
    this.compileCallExtension(node, frame, true);
  }

  compileNodeList(node, frame) {
    this._compileChildren(node, frame);
  }

  compileLiteral(node) {
    if (typeof node.value === 'string') {
      let val = node.value.replace(/\\/g, '\\\\');
      val = val.replace(/"/g, '\\"');
      val = val.replace(/\n/g, '\\n');
      val = val.replace(/\r/g, '\\r');
      val = val.replace(/\t/g, '\\t');
      val = val.replace(/\u2028/g, '\\u2028');
      this._emit(`"${val}"`);
    } else if (node.value === null) {
      this._emit('null');
    } else {
      this._emit(node.value.toString());
    }
  }

  compileSymbol(node, frame) {
    var name = node.value;
    var v = frame.lookup(name);

    if (v) {
      this._emit(v);
    } else {
      this._emit('runtime.contextOrFrameLookup(' +
        'context, frame, "' + name + '")');
    }
  }

  compileGroup(node, frame) {
    this._compileAggregate(node, frame, '(', ')');
  }

  compileArray(node, frame) {
    this._compileAggregate(node, frame, '[', ']');
  }

  compileDict(node, frame) {
    this._compileAggregate(node, frame, '{', '}');
  }

  compilePair(node, frame) {
    var key = node.key;
    var val = node.value;

    if (key instanceof nodes.Symbol) {
      key = new nodes.Literal(key.lineno, key.colno, key.value);
    } else if (!(key instanceof nodes.Literal &&
      typeof key.value === 'string')) {
      this.fail('compilePair: Dict keys must be strings or names',
        key.lineno,
        key.colno);
    }

    this.compile(key, frame);
    this._emit(': ');
    this._compileExpression(val, frame);
  }

  compileInlineIf(node, frame) {
    this._emit('(');
    this.compile(node.cond, frame);
    this._emit('?');
    this.compile(node.body, frame);
    this._emit(':');
    if (node.else_ !== null) {
      this.compile(node.else_, frame);
    } else {
      this._emit('""');
    }
    this._emit(')');
  }

  compileIn(node, frame) {
    this._emit('runtime.inOperator(');
    this.compile(node.left, frame);
    this._emit(',');
    this.compile(node.right, frame);
    this._emit(')');
  }

  compileIs(node, frame) {
    var right = node.right.name
      ? node.right.name.value
      : node.right.value;
    this._emit('env.getTest("' + right + '").call(context, ');
    this.compile(node.left, frame);
    if (node.right.args) {
      this._emit(',');
      this.compile(node.right.args, frame);
    }
    this._emit(') === true');
  }

  _binOpEmitter(node, frame, str) {
    this.compile(node.left, frame);
    this._emit(str);
    this.compile(node.right, frame);
  }

  compileOr(node, frame) {
    return this._binOpEmitter(node, frame, ' || ');
  }

  compileAnd(node, frame) {
    return this._binOpEmitter(node, frame, ' && ');
  }

  compileNullishCoalesce(node, frame) {
    this._emit('runtime.nullishCoalesce(');
    this.compile(node.left, frame);
    this._emit(',');
    this.compile(node.right, frame);
    this._emit(')');
  }

  compileAdd(node, frame) {
    return this._binOpEmitter(node, frame, ' + ');
  }

  compileConcat(node, frame) {
    return this._binOpEmitter(node, frame, ' + "" + ');
  }

  compileSub(node, frame) {
    return this._binOpEmitter(node, frame, ' - ');
  }

  compileMul(node, frame) {
    return this._binOpEmitter(node, frame, ' * ');
  }

  compileDiv(node, frame) {
    return this._binOpEmitter(node, frame, ' / ');
  }

  compileMod(node, frame) {
    return this._binOpEmitter(node, frame, ' % ');
  }

  compileNot(node, frame) {
    this._emit('!');
    this.compile(node.target, frame);
  }

  compileFloorDiv(node, frame) {
    this._emit('Math.floor(');
    this.compile(node.left, frame);
    this._emit(' / ');
    this.compile(node.right, frame);
    this._emit(')');
  }

  compilePow(node, frame) {
    this._emit('Math.pow(');
    this.compile(node.left, frame);
    this._emit(', ');
    this.compile(node.right, frame);
    this._emit(')');
  }

  compileNeg(node, frame) {
    this._emit('-');
    this.compile(node.target, frame);
  }

  compilePos(node, frame) {
    this._emit('+');
    this.compile(node.target, frame);
  }

  compileCompare(node, frame) {
    this.compile(node.expr, frame);

    node.ops.forEach((op) => {
      this._emit(` ${compareOps[op.type]} `);
      this.compile(op.expr, frame);
    });
  }

  compileLookupVal(node, frame) {
    if (node.val instanceof nodes.Slice) {
      // Slice: emit runtime.slice(arr, start, stop, step)
      this._emit('runtime.slice((');
      this._compileExpression(node.target, frame);
      this._emit('), ');
      if (node.val.start) {
        this._compileExpression(node.val.start, frame);
      } else {
        this._emit('null');
      }
      this._emit(', ');
      if (node.val.stop) {
        this._compileExpression(node.val.stop, frame);
      } else {
        this._emit('null');
      }
      this._emit(', ');
      if (node.val.step) {
        this._compileExpression(node.val.step, frame);
      } else {
        this._emit('null');
      }
      this._emit(')');
    } else {
      this._emit('runtime.memberLookup((');
      this._compileExpression(node.target, frame);
      this._emit('),');
      this._compileExpression(node.val, frame);
      this._emit(')');
    }
  }

  compileOptionalChain(node, frame) {
    this._emit('runtime.optionalMemberLookup((');
    this._compileExpression(node.target, frame);
    this._emit('),');
    this._compileExpression(node.val, frame);
    this._emit(')');
  }

  compileSlice(node, frame) {
    this._emit('runtime.slice((');
    if (node.start) {
      this._compileExpression(node.start, frame);
    } else {
      this._emit('null');
    }
    this._emit('), (');
    if (node.stop) {
      this._compileExpression(node.stop, frame);
    } else {
      this._emit('null');
    }
    this._emit('), (');
    if (node.step) {
      this._compileExpression(node.step, frame);
    } else {
      this._emit('null');
    }
    this._emit('))');
  }

  _getNodeName(node) {
    switch (node.typename) {
      case 'Symbol':
        return node.value;
      case 'FunCall':
        return 'the return value of (' + this._getNodeName(node.name) + ')';
      case 'LookupVal':
        return this._getNodeName(node.target) + '["' +
          this._getNodeName(node.val) + '"]';
      case 'OptionalChain':
        return this._getNodeName(node.target) + '?.["' +
          this._getNodeName(node.val) + '"]';
      case 'Literal':
        return node.value.toString();
      default:
        return '--expression--';
    }
  }

  compileFunCall(node, frame) {
    this._emit('(lineno = ' + node.lineno +
      ', colno = ' + node.colno + ', ');

    this._emit('runtime.callWrap(');
    this._compileExpression(node.name, frame);

    this._emit(', "' + this._getNodeName(node.name).replace(/"/g, '\\"') + '", context, ');

    this._compileAggregate(node.args, frame, '[', '], ' + node.lineno + ', ' + node.colno + '))');
  }

  compilePipe(node, frame) {
    var name = node.name;
    this.assertType(name, nodes.Symbol);
    this._emit('await runtime.awaitValue(env.getFilter("' + name.value + '").call(context, ');
    this._compileAggregate(node.args, frame);
    this._emit('))');
  }

  compilePipeAsync(node, frame) {
    var name = node.name;
    var symbol = node.symbol.value;

    this.assertType(name, nodes.Symbol);

    frame.set(symbol, symbol);

    this._emit(symbol + ' = await runtime.awaitValue(env.getFilter("' + name.value + '").call(context, ');
    this._compileAggregate(node.args, frame);
    this._emitLine('));');
  }

  compileKeywordArgs(node, frame) {
    this._emit('runtime.makeKeywordArgs(');
    this.compileDict(node, frame);
    this._emit(')');
  }

  compileSet(node, frame) {
    var ids = [];

    node.targets.forEach((target) => {
      var name = target.value;
      var id = frame.lookup(name);

      if (id === null || id === undefined) {
        id = this._tmpid();

        this._emitLine('var ' + id + ';');
      }

      ids.push(id);
    });

    if (node.value) {
      const op = node.operator || '=';
      this._emit(ids.join(' = ') + ' ' + op + ' ');
      this._compileExpression(node.value, frame);
      this._emitLine(';');
    } else {
      this._emit(ids.join(' = ') + ' = await ');
      this.compile(node.body, frame);
      this._emitLine(';');
    }

    node.targets.forEach((target, i) => {
      var id = ids[i];
      var name = target.value;

      this._emitLine(`frame.set("${name}", ${id}, true);`);

      this._emitLine('if(frame.topLevel) {');
      this._emitLine(`context.setVariable("${name}", ${id});`);
      this._emitLine('}');

      if (name.charAt(0) !== '_') {
        this._emitLine('if(frame.topLevel) {');
        this._emitLine(`context.addExport("${name}", ${id});`);
        this._emitLine('}');
      }
    });
  }

  compileSwitch(node, frame) {
    this._emit('switch (');
    this.compile(node.expr, frame);
    this._emit(') {');
    node.cases.forEach((c, i) => {
      this._emit('case ');
      this.compile(c.cond, frame);
      this._emit(': ');
      this.compile(c.body, frame);
      if (c.body.children.length) {
        this._emitLine('break;');
      }
    });
    if (node.default) {
      this._emit('default:');
      this.compile(node.default, frame);
    }
    this._emit('}');
  }

  compileIf(node, frame, async) {
    this._emit('if(');
    this._compileExpression(node.cond, frame);
    this._emitLine(') {');

    this._withScopedSyntax(() => {
      this.compile(node.body, frame);
    });

    if (node.else_) {
      this._emitLine('}\nelse {');

      this._withScopedSyntax(() => {
        this.compile(node.else_, frame);
      });
    }

    this._emitLine('}');
  }

  compileIfAsync(node, frame) {
    this._emit('await (async function() {');
    this.compileIf(node, frame, true);
    this._emit('})();');
  }

  _emitLoopBindings(node, arr, i, len) {
    const bindings = [
      {name: 'index', val: `${i} + 1`},
      {name: 'index0', val: i},
      {name: 'revindex', val: `${len} - ${i}`},
      {name: 'revindex0', val: `${len} - ${i} - 1`},
      {name: 'first', val: `${i} === 0`},
      {name: 'last', val: `${i} === ${len} - 1`},
      {name: 'length', val: len},
    ];

    bindings.forEach((b) => {
      this._emitLine(`frame.set("loop.${b.name}", ${b.val});`);
    });
  }

  compileFor(node, frame) {
    const i = this._tmpid();
    const len = this._tmpid();
    const arr = this._tmpid();
    frame = frame.push();

    this._emitLine('frame = frame.push();');

    this._emit(`var ${arr} = `);
    this._compileExpression(node.arr, frame);
    this._emitLine(';');

    this._emit(`if(${arr}) {`);
    this._emitLine(arr + ' = runtime.fromIterator(' + arr + ');');

    if (node.name instanceof nodes.Array) {
      this._emitLine(`var ${i};`);

      this._emitLine(`if(runtime.isArray(${arr})) {`);
      this._emitLine(`var ${len} = ${arr}.length;`);
      this._emitLine(`for(${i}=0; ${i} < ${arr}.length; ${i}++) {`);

      node.name.children.forEach((child, u) => {
        var tid = this._tmpid();
        this._emitLine(`var ${tid} = ${arr}[${i}][${u}];`);
        this._emitLine(`frame.set("${child}", ${arr}[${i}][${u}]);`);
        frame.set(node.name.children[u].value, tid);
      });

      this._emitLoopBindings(node, arr, i, len);
      this._withScopedSyntax(() => {
        this.compile(node.body, frame);
      });
      this._emitLine('}');

      this._emitLine('} else {');
      const [key, val] = node.name.children;
      const k = this._tmpid();
      const v = this._tmpid();
      frame.set(key.value, k);
      frame.set(val.value, v);

      this._emitLine(`${i} = -1;`);
      this._emitLine(`var ${len} = runtime.keys(${arr}).length;`);
      this._emitLine(`for(var ${k} in ${arr}) {`);
      this._emitLine(`${i}++;`);
      this._emitLine(`var ${v} = ${arr}[${k}];`);
      this._emitLine(`frame.set("${key.value}", ${k});`);
      this._emitLine(`frame.set("${val.value}", ${v});`);

      this._emitLoopBindings(node, arr, i, len);
      this._withScopedSyntax(() => {
        this.compile(node.body, frame);
      });
      this._emitLine('}');

      this._emitLine('}');
    } else {
      const v = this._tmpid();
      frame.set(node.name.value, v);

      this._emitLine(`var ${len} = ${arr}.length;`);
      this._emitLine(`for(var ${i}=0; ${i} < ${arr}.length; ${i}++) {`);
      this._emitLine(`var ${v} = ${arr}[${i}];`);
      this._emitLine(`frame.set("${node.name.value}", ${v});`);

      this._emitLoopBindings(node, arr, i, len);

      this._withScopedSyntax(() => {
        this.compile(node.body, frame);
      });

      this._emitLine('}');
    }

    this._emitLine('}');
    if (node.else_) {
      this._emitLine('if (!' + len + ') {');
      this.compile(node.else_, frame);
      this._emitLine('}');
    }

    this._emitLine('frame = frame.pop();');
  }

  _compileAsyncLoop(node, frame, parallel) {
    var i = this._tmpid();
    var len = this._tmpid();
    var arr = this._tmpid();
    frame = frame.push();

    this._emitLine('frame = frame.push();');

    this._emit('var ' + arr + ' = runtime.fromIterator(');
    this._compileExpression(node.arr, frame);
    this._emitLine(');');

    if (parallel) {
      this._compileAsyncAllLoop(node, frame, arr, i, len);
    } else {
      this._compileAsyncEachLoop(node, frame, arr, i, len);
    }

    if (node.else_) {
      this._emitLine('if (!' + arr + '.length) {');
      this.compile(node.else_, frame);
      this._emitLine('}');
    }

    this._emitLine('frame = frame.pop();');
  }

  _compileAsyncEachLoop(node, frame, arr, i, len) {
    const loopId = this._tmpid();

    if (node.name instanceof nodes.Array) {
      const isObj = this._tmpid();
      const arrLen = this._tmpid();
      this._emitLine(`var ${isObj} = !runtime.isArray(${arr});`);
      this._emitLine(`var ${arrLen} = ${isObj} ? (${arr} ? runtime.keys(${arr}).length : 0) : (${arr} ? ${arr}.length : 0);`);
      this._emitLine(`var ${len} = ${arrLen};`);
      this._emitLine(`for (var ${i}=0; ${i}<${len}; ${i}++) {`);
      this._emitLine(`var ${loopId} = ${isObj} ? runtime.keys(${arr})[${i}] : ${i};`);

      node.name.children.forEach((name, idx) => {
        const id = name.value;
        if (idx === 0) {
          this._emitLine(`var ${id} = ${isObj} ? ${loopId} : ${arr}[${loopId}][${idx}];`);
        } else if (idx === 1) {
          this._emitLine(`var ${id} = ${isObj} ? ${arr}[${loopId}] : ${arr}[${loopId}][${idx}];`);
        } else {
          this._emitLine(`var ${id} = ${arr}[${loopId}][${idx}];`);
        }
        this._emitLine(`frame.set("${id}", ${id});`);
        frame.set(id, id);
      });
    } else {
      const id = node.name.value;
      this._emitLine(`var ${len} = ${arr} ? ${arr}.length : 0;`);
      this._emitLine(`for (var ${i}=0; ${i}<${len}; ${i}++) {`);
      this._emitLine(`var ${id} = ${arr}[${i}];`);
      this._emitLine('frame.set("' + id + '", ' + id + ');');
      frame.set(id, id);
    }

    this._emitLoopBindings(node, arr, i, len);

    this._withScopedSyntax(() => {
      this.compile(node.body, frame);
    });

    this._emitLine('}');
  }

  _compileAsyncAllLoop(node, frame, arr, i, len) {
    const loopId = this._tmpid();
    this._pushBuffer();
    const resultsVar = this._tmpid();

    this._emitLine(`var ${resultsVar} = [];`);

    if (node.name instanceof nodes.Array) {
      const isObj = this._tmpid();
      const arrLen = this._tmpid();
      this._emitLine(`var ${isObj} = !runtime.isArray(${arr});`);
      this._emitLine(`var ${arrLen} = ${isObj} ? (${arr} ? runtime.keys(${arr}).length : 0) : (${arr} ? ${arr}.length : 0);`);
      this._emitLine(`var ${len} = ${arrLen};`);
      this._emitLine(`for (var ${i}=0; ${i}<${len}; ${i}++) {`);
      this._emitLine(`var ${loopId} = ${isObj} ? runtime.keys(${arr})[${i}] : ${i};`);

      node.name.children.forEach((name, idx) => {
        const id = name.value;
        if (idx === 0) {
          this._emitLine(`var ${id} = ${isObj} ? ${loopId} : ${arr}[${loopId}][${idx}];`);
        } else if (idx === 1) {
          this._emitLine(`var ${id} = ${isObj} ? ${arr}[${loopId}] : ${arr}[${loopId}][${idx}];`);
        } else {
          this._emitLine(`var ${id} = ${arr}[${loopId}][${idx}];`);
        }
        this._emitLine(`frame.set("${id}", ${id});`);
        frame.set(id, id);
      });
    } else {
      const id = node.name.value;
      this._emitLine(`var ${len} = ${arr} ? ${arr}.length : 0;`);
      this._emitLine(`for (var ${i}=0; ${i}<${len}; ${i}++) {`);
      this._emitLine(`var ${id} = ${arr}[${i}];`);
      this._emitLine('frame.set("' + id + '", ' + id + ');');
      frame.set(id, id);
    }

    this._emitLoopBindings(node, arr, i, len);

    this._withScopedSyntax(() => {
      const itemBuf = this._tmpid();
      this._emitLine(`var ${itemBuf} = "";`);
      const savedBuffer = this.buffer;
      this.buffer = itemBuf;
      this.compile(node.body, frame);
      this.buffer = savedBuffer;
      this._emitLine(`${resultsVar}.push(${itemBuf});`);
    });

    this._emitLine('}');
    this._popBuffer();

    this._emitLine(`for (var ${i}=0; ${i}<${resultsVar}.length; ${i}++) {`);
    this._emitLine(`${this.buffer} += ${resultsVar}[${i}];`);
    this._emitLine('}');
  }

  compileAsyncEach(node, frame) {
    this._compileAsyncLoop(node, frame);
  }

  compileAsyncAll(node, frame) {
    this._compileAsyncLoop(node, frame, true);
  }

  _compileMacro(node, frame) {
    var args = [];
    var kwargs = null;
    var funcId = 'macro_' + this._tmpid();
    var keepFrame = (frame !== undefined);

    node.args.children.forEach((arg, i) => {
      if (i === node.args.children.length - 1 && arg instanceof nodes.Dict) {
        kwargs = arg;
      } else {
        this.assertType(arg, nodes.Symbol);
        args.push(arg);
      }
    });

    const realNames = [...args.map((n) => `l_${n.value}`), 'kwargs'];

    const argNames = args.map((n) => `"${n.value}"`);
    const kwargNames = ((kwargs && kwargs.children) || []).map((n) => `"${n.key.value}"`);

    let currFrame;
    if (keepFrame) {
      currFrame = frame.push(true);
    } else {
      currFrame = new Frame();
    }
    this._emitLines(
      `var ${funcId} = runtime.makeMacro(`,
      `[${argNames.join(', ')}], `,
      `[${kwargNames.join(', ')}], `,
      `async function (${realNames.join(', ')}) {`,
      'var callerFrame = frame;',
      'frame = ' + ((keepFrame) ? 'frame.push(true);' : 'new runtime.Frame();'),
      'kwargs = kwargs || {};',
      'if (Object.prototype.hasOwnProperty.call(kwargs, "caller")) {',
      'frame.set("caller", kwargs.caller); }');

    args.forEach((arg) => {
      this._emitLine(`frame.set("${arg.value}", l_${arg.value});`);
      currFrame.set(arg.value, `l_${arg.value}`);
    });

    if (kwargs) {
      kwargs.children.forEach((pair) => {
        const name = pair.key.value;
        this._emit(`frame.set("${name}", `);
        this._emit(`Object.prototype.hasOwnProperty.call(kwargs, "${name}")`);
        this._emit(` ? kwargs["${name}"] : `);
        this._compileExpression(pair.value, currFrame);
        this._emit(');');
      });
    }

    const bufferId = this._pushBuffer();

    this._withScopedSyntax(() => {
      this.compile(node.body, currFrame);
    });

    this._emitLine('frame = ' + ((keepFrame) ? 'frame.pop();' : 'callerFrame;'));
    this._emitLine(`return new runtime.SafeString(${bufferId});`);
    this._emitLine('});');
    this._popBuffer();

    return funcId;
  }

  compileMacro(node, frame) {
    var funcId = this._compileMacro(node);

    var name = node.name.value;
    frame.set(name, funcId);

    if (frame.parent) {
      this._emitLine(`frame.set("${name}", ${funcId});`);
    } else {
      if (node.name.value.charAt(0) !== '_') {
        this._emitLine(`context.addExport("${name}");`);
      }
      this._emitLine(`context.setVariable("${name}", ${funcId});`);
    }
  }

  compileCaller(node, frame) {
    this._emit('(function (){');
    const funcId = this._compileMacro(node, frame);
    this._emit(`return ${funcId};})()`);
  }

  _compileGetTemplate(node, frame, eagerCompile, ignoreMissing) {
    const parentTemplateId = this._tmpid();
    const parentName = this._templateName();
    const eagerCompileArg = (eagerCompile) ? 'true' : 'false';
    const ignoreMissingArg = (ignoreMissing) ? 'true' : 'false';
    this._emit(`var ${parentTemplateId} = await env.getTemplate(`);
    this._compileExpression(node.template, frame);
    this._emitLine(`, ${eagerCompileArg}, ${parentName}, ${ignoreMissingArg});`);
    return parentTemplateId;
  }

  compileImport(node, frame) {
    const target = node.target.value;
    const id = this._compileGetTemplate(node, frame, false, false);

    this._emitLine(`var ${id}_exported = await ${id}.getExported(` +
      (node.withContext ? 'context.getVariables(), frame' : '') +
      ');');

    if (frame.parent) {
      this._emitLine(`frame.set("${target}", ${id}_exported);`);
    } else {
      this._emitLine(`context.setVariable("${target}", ${id}_exported);`);
    }
  }

  compileFromImport(node, frame) {
    const importedId = this._compileGetTemplate(node, frame, false, false);

    this._emitLine(`var ${importedId}_exported = await ${importedId}.getExported(` +
      (node.withContext ? 'context.getVariables(), frame' : '') +
      ');');

    node.names.children.forEach((nameNode) => {
      var name;
      var alias;
      var id = this._tmpid();

      if (nameNode instanceof nodes.Pair) {
        name = nameNode.key.value;
        alias = nameNode.value.value;
      } else {
        name = nameNode.value;
        alias = name;
      }

      this._emitLine(`if(Object.prototype.hasOwnProperty.call(${importedId}_exported, "${name}")) {`);
      this._emitLine(`var ${id} = ${importedId}_exported["${name}"];`);
      this._emitLine('} else {');
      this._emitLine(`throw new Error("cannot import '${name}'");`);
      this._emitLine('}');

      frame.set(alias, id);

      if (frame.parent) {
        this._emitLine(`frame.set("${alias}", ${id});`);
      } else {
        this._emitLine(`context.setVariable("${alias}", ${id});`);
      }
    });
  }

  compileBlock(node) {
    var id = this._tmpid();

    if (!this.inBlock) {
      this._emitLine(`var ${id} = await (await context.getBlock("${node.name.value}"))(env, context, frame, runtime);`);
    } else {
      this._emitLine(`var ${id} = await (await context.getBlock("${node.name.value}"))(env, context, frame, runtime);`);
    }
    this._emitLine(`${this.buffer} += ${id};`);
  }

  compileSuper(node, frame) {
    var name = node.blockName.value;
    var id = node.symbol.value;

    this._emitLine(`${id} = await context.getSuper(env, "${name}", b_${name}, frame, runtime);`);
    this._emitLine(`${id} = runtime.markSafe(${id});`);
    frame.set(id, id);
  }

  compileExtends(node, frame) {
    var k = this._tmpid();

    const parentTemplateId = this._compileGetTemplate(node, frame, true, false);

    this._emitLine(`parentTemplate = ${parentTemplateId}`);

    this._emitLine(`for(var ${k} in parentTemplate.blocks) {`);
    this._emitLine(`context.addBlock(${k}, parentTemplate.blocks[${k}]);`);
    this._emitLine('}');
  }

  compileInclude(node, frame) {
    const tmplVar = this._tmpid();
    const resultVar = this._tmpid();

    this._emit(`var ${tmplVar} = await env.getTemplate(`);
    this._compileExpression(node.template, frame);
    const ignoreMissing = node.ignoreMissing ? 'true' : 'false';
    const includeChain = `{parentTmpl: ${this._templateName()}, parentLineno: ${node.lineno + 1}, parentColno: ${node.colno !== undefined ? node.colno + 1 : 0}}`;
    this._emitLine(`, false, ${includeChain}, ${ignoreMissing});`);

    this._emit(`var ${resultVar} = await ${tmplVar}.render(context.getVariables(), frame);`);
    this._emitLine(`${this.buffer} += ${resultVar};`);
  }

  compileTemplateData(node, frame) {
    this.compileLiteral(node, frame);
  }

  compileCapture(node, frame) {
    var buffer = this.buffer;
    this.buffer = 'output';
    this._emitLine('(async function() {');
    this._emitLine('var output = "";');
    this._withScopedSyntax(() => {
      this.compile(node.body, frame);
    });
    this._emitLine('return output;');
    this._emitLine('})()');
    this.buffer = buffer;
  }

  compileOutput(node, frame) {
    const children = node.children;
    children.forEach(child => {
      if (child instanceof nodes.TemplateData) {
        if (child.value) {
          this._emit(`${this.buffer} += `);
          this.compileLiteral(child, frame);
          this._emit(';');
        }
      } else {
        const isPipe = child instanceof nodes.Pipe || child instanceof nodes.PipeAsync;
        const varName = child instanceof nodes.Symbol ? child.value : null;
        this._emitLineWithLineno(`lineno = ${child.lineno}; colno = ${child.colno}; ${this.buffer} += runtime.suppressValue(`, child.lineno, child.colno);
        if (!isPipe) {
          this._emit('await runtime.awaitValue(');
        }
        if (this.throwOnUndefined) {
          this._emit('runtime.ensureDefined(');
        }
        this.compile(child, frame);
        if (this.throwOnUndefined) {
          const nameArg = varName ? `, "${varName}"` : '';
          this._emit(`,${child.lineno},${child.colno}${nameArg})`);
        }
        if (!isPipe) {
          this._emit(')');
        }
        this._emit(', env.opts.autoescape);');
      }
    });
    this._emit('\n');
  }

  compileRoot(node, frame) {
    if (frame) {
      this.fail('compileRoot: root node can\'t have frame');
    }

    frame = new Frame();

    this._emitFuncBegin(node, 'root');
    this._emitLine('var parentTemplate = null;');
    const childBuffer = 'childOutput';
    this._emitLine(`var ${childBuffer} = "";`);
    const savedBuffer = this.buffer;
    this.buffer = childBuffer;
    this._compileChildren(node, frame);
    this.buffer = savedBuffer;
    this._emitLine('if(parentTemplate) {');
    this._emitLine(`return await parentTemplate.rootRenderFunc(env, context, frame, runtime);`);
    this._emitLine('}');
    this._emitLine(`return ${childBuffer};`);
    this._emitFuncEnd(true);

    this.inBlock = true;

    const blockNames = [];

    const blocks = node.findAll(nodes.Block);

    blocks.forEach((block, i) => {
      const name = block.name.value;

      if (blockNames.indexOf(name) !== -1) {
        throw new Error(`Block "${name}" defined more than once.`);
      }
      blockNames.push(name);

      this._emitFuncBegin(block, `b_${name}`);

      const tmpFrame = new Frame();
      this._emitLine('var frame = frame.push(true);');
      this.compile(block.body, tmpFrame);
      this._emitFuncEnd();
    });

    this._emitLine('return {');

    blocks.forEach((block, i) => {
      const blockName = `b_${block.name.value}`;
      this._emitLine(`${blockName}: ${blockName},`);
    });

    this._emitLine('root: root\n};');
  }

  compile(node, frame) {
    var _compile = this['compile' + node.typename];
    if (_compile) {
      _compile.call(this, node, frame);
    } else {
      this.fail(`compile: Cannot compile node: ${node.typename}`, node.lineno, node.colno);
    }
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
