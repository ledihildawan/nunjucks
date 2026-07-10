import { createObj, extendObj } from '../object/index.js';

function traverseAndCheck(obj, type, results) {
  if (obj?.typename === type.typename) {
    results.push(obj);
  }

  if (obj?.typename === 'NodeList' || (obj?.children && Array.isArray(obj.children))) {
    obj.children.forEach(child => traverseAndCheck(child, type, results));
  } else if (obj?.typename && obj?.typename !== 'NodeList' && obj?.fields) {
    obj.fields.forEach(field => traverseAndCheck(obj[field], type, results));
  }
}

export function createNode(name, fields, initFn) {
  const nodeInit = function(lineno, colno, ...args) {
    this.lineno = lineno;
    this.colno = colno;

    fields.forEach((field, i) => {
      var val = args[i];
      if (val === undefined) {
        val = null;
      }
      this[field] = val;
    });

    if (initFn) {
      initFn.call(this, lineno, colno, ...args);
    }
  };

  const findAllMethod = function(type, results) {
    results = results || [];

    if (this.typename === 'NodeList' || (this.children && Array.isArray(this.children))) {
      this.children.forEach(child => traverseAndCheck(child, type, results));
    } else if (this.typename && this.typename !== 'NodeList' && this.fields) {
      this.fields.forEach(field => traverseAndCheck(this[field], type, results));
    }

    return results;
  };

  const iterFieldsMethod = function(func) {
    this.fields.forEach((field) => {
      func(this[field], field);
    });
  };

  const factoryFn = function(...args) {
    if (this instanceof factoryFn) {
      factoryFn.init.apply(this, args);
      return this;
    }
    const instance = Object.create(factoryFn.prototype);
    instance.init(...args);
    return instance;
  };

  factoryFn.prototype.init = nodeInit;
  factoryFn.prototype.findAll = findAllMethod;
  factoryFn.prototype.iterFields = iterFieldsMethod;
  Object.defineProperty(factoryFn.prototype, 'fields', { get: () => fields, configurable: true });
  Object.defineProperty(factoryFn.prototype, 'typename', { get: () => name, configurable: true });

  factoryFn.typename = name;
  factoryFn.init = nodeInit;
  factoryFn.fields = fields;
  factoryFn.findAll = findAllMethod;
  factoryFn.iterFields = iterFieldsMethod;
  factoryFn.extend = function(name, props) {
    return extendObj(this, name, props);
  };

  return factoryFn;
}

export const Node = createNode('Node', []);
export const Value = createNode('Value', ['value']);

export const NodeList = createNode('NodeList', ['children'], function(lineno, colno, nodes) {
  if (!this.children) {
    this.children = [];
  }
  if (nodes) {
    this.children = Array.isArray(nodes) ? nodes : [nodes];
  }
});
NodeList.prototype.addChild = function(node) {
  this.children.push(node);
};

export const Root = extendObj(NodeList, 'Root', {});
export const Literal = extendObj(Value, 'Literal', {});
export const AstSymbol = extendObj(Value, 'Symbol', {});
export const Group = extendObj(NodeList, 'Group', {});
export const ArrayNode = extendObj(NodeList, 'Array', {});
export { ArrayNode as Array };
export const Pair = extendObj(Node, 'Pair', { fields: ['key', 'value'] });
export const Dict = extendObj(NodeList, 'Dict', {});
export const LookupVal = extendObj(Node, 'LookupVal', { fields: ['target', 'val'] });
export const OptionalChain = extendObj(Node, 'OptionalChain', { fields: ['target', 'val'] });
export const Slice = extendObj(Node, 'Slice', { fields: ['start', 'stop', 'step'] });
export const If = extendObj(Node, 'If', { fields: ['cond', 'body', 'else_'] });
export const IfAsync = extendObj(If, 'IfAsync', {});
export const InlineIf = extendObj(Node, 'InlineIf', { fields: ['cond', 'body', 'else_'] });
export const For = extendObj(Node, 'For', { fields: ['arr', 'name', 'body', 'else_'] });
export const AsyncEach = extendObj(For, 'AsyncEach', {});
export const AsyncAll = extendObj(For, 'AsyncAll', {});
export const Macro = extendObj(Node, 'Macro', { fields: ['name', 'args', 'body'] });
export const Caller = extendObj(Macro, 'Caller', {});
export const Import = extendObj(Node, 'Import', { fields: ['template', 'target', 'withContext'] });

export const FromImport = createNode('FromImport', ['template', 'names', 'withContext'], function(lineno, colno, template, names, withContext) {
  if (!this.names) {
    this.names = NodeList(lineno, colno);
  }
});

export const FunCall = extendObj(Node, 'FunCall', { fields: ['name', 'args'] });
export const Pipe = extendObj(FunCall, 'Pipe', {});
export const PipeAsync = extendObj(Pipe, 'PipeAsync', { fields: ['symbol'] });
export const Filter = Pipe;
export const FilterAsync = PipeAsync;
export const KeywordArgs = extendObj(Dict, 'KeywordArgs', {});
export const Block = extendObj(Node, 'Block', { fields: ['name', 'body'] });
export const Super = extendObj(Node, 'Super', { fields: ['blockName', 'symbol'] });
export const TemplateRef = extendObj(Node, 'TemplateRef', { fields: ['template'] });
export const Extends = extendObj(TemplateRef, 'Extends', {});
export const Include = extendObj(Node, 'Include', { fields: ['template', 'ignoreMissing'] });
export const Set = extendObj(Node, 'Set', { fields: ['targets', 'value', 'operator'] });
export const Switch = extendObj(Node, 'Switch', { fields: ['expr', 'cases', 'default'] });
export const Case = extendObj(Node, 'Case', { fields: ['cond', 'body'] });
export const Output = extendObj(NodeList, 'Output', {});
export const Capture = extendObj(Node, 'Capture', { fields: ['body'] });
export const TemplateData = extendObj(Literal, 'TemplateData', {});
export const UnaryOp = extendObj(Node, 'UnaryOp', { fields: ['target'] });
export const BinOp = extendObj(Node, 'BinOp', { fields: ['left', 'right'] });
export const In = extendObj(BinOp, 'In', {});
export const Is = extendObj(BinOp, 'Is', {});
export const Or = extendObj(BinOp, 'Or', {});
export const And = extendObj(BinOp, 'And', {});
export const NullishCoalesce = extendObj(BinOp, 'NullishCoalesce', {});
export const Not = extendObj(UnaryOp, 'Not', {});
export const Add = extendObj(BinOp, 'Add', {});
export const Concat = extendObj(BinOp, 'Concat', {});
export const Sub = extendObj(BinOp, 'Sub', {});
export const Mul = extendObj(BinOp, 'Mul', {});
export const Div = extendObj(BinOp, 'Div', {});
export const FloorDiv = extendObj(BinOp, 'FloorDiv', {});
export const Mod = extendObj(BinOp, 'Mod', {});
export const Pow = extendObj(BinOp, 'Pow', {});
export const Neg = extendObj(UnaryOp, 'Neg', {});
export const Pos = extendObj(UnaryOp, 'Pos', {});
export const Compare = extendObj(Node, 'Compare', { fields: ['expr', 'ops'] });
export const CompareOperand = extendObj(Node, 'CompareOperand', { fields: ['expr', 'type'] });
export const CallExtension = extendObj(Node, 'CallExtension', {
  fields: ['extName', 'prop', 'args', 'contentArgs'],
  init: function(ext, prop, args, contentArgs) {
    this.extName = ext.__name || ext;
    this.prop = prop;
    this.args = args || NodeList(0, 0);
    this.contentArgs = contentArgs || [];
    this.autoescape = ext.autoescape;
  }
});
export const CallExtensionAsync = extendObj(CallExtension, 'CallExtensionAsync', {});

export function isType(node, type) {
  return node?.typename === type?.typename || node?.typename === type;
}
