import { createObj, extendObj } from '../object/index.js';

export const NODE = Symbol('node');

export const BracketNotation = Symbol('BracketNotation');

export const SYMBOLS = {
  Node: Symbol('Node'),
  Value: Symbol('Value'),
  Literal: Symbol('Literal'),
  Symbol: Symbol('Symbol'),
  NodeList: Symbol('NodeList'),
  Output: Symbol('Output'),
  FunCall: Symbol('FunCall'),
  Pipe: Symbol('Pipe'),
  Filter: Symbol('Filter'),
  Block: Symbol('Block'),
  Extends: Symbol('Extends'),
  Include: Symbol('Include'),
  Macro: Symbol('Macro'),
  Set: Symbol('Set'),
  If: Symbol('If'),
  For: Symbol('For'),
  Compare: Symbol('Compare'),
  LookupVal: Symbol('LookupVal'),
  CallExtension: Symbol('CallExtension'),
  CallExtensionAsync: Symbol('CallExtensionAsync'),
  Dict: Symbol('Dict'),
  Array: Symbol('Array'),
  Pair: Symbol('Pair'),
  Concat: Symbol('Concat'),
  Add: Symbol('Add'),
  BinOp: Symbol('BinOp'),
  UnaryOp: Symbol('UnaryOp'),
  KeywordArgs: Symbol('KeywordArgs'),
  Root: Symbol('Root'),
  Slice: Symbol('Slice'),
  Group: Symbol('Group'),
  TemplateData: Symbol('TemplateData'),
  InlineIf: Symbol('InlineIf'),
  Or: Symbol('Or'),
  And: Symbol('And'),
  Not: Symbol('Not'),
  CompareOperand: Symbol('CompareOperand'),
  Sub: Symbol('Sub'),
  Mul: Symbol('Mul'),
  Div: Symbol('Div'),
  FloorDiv: Symbol('FloorDiv'),
  Mod: Symbol('Mod'),
  Pow: Symbol('Pow'),
  Neg: Symbol('Neg'),
  Pos: Symbol('Pos'),
  Super: Symbol('Super'),
  TemplateRef: Symbol('TemplateRef'),
  Import: Symbol('Import'),
  FromImport: Symbol('FromImport'),
  Switch: Symbol('Switch'),
  Case: Symbol('Case'),
  Capture: Symbol('Capture'),
  Caller: Symbol('Caller'),
  OptionalChain: Symbol('OptionalChain'),
  OptionalCall: Symbol('OptionalCall'),
  PipeAsync: Symbol('PipeAsync'),
  NullishCoalesce: Symbol('NullishCoalesce'),
  In: Symbol('In'),
  Is: Symbol('Is'),
};

const REVERSE_SYMBOLS = new Map();
Object.keys(SYMBOLS).forEach(key => {
  REVERSE_SYMBOLS.set(SYMBOLS[key], key);
});
REVERSE_SYMBOLS.set(NODE, 'Node');

const extendObjWithSymbol = (base, name, props = {}) => {
  const symbol = SYMBOLS[name];
  return extendObj(base, name, { ...props, symbol });
};

export function getNodeTypeName(node) {
  if (!node) return undefined;
  
  // Check the factory function's typename property (set on the init function's prototype)
  // This is the most reliable way to get the type name
  const proto = Object.getPrototypeOf(node);
  if (proto && proto.constructor && proto.constructor.typename) {
    return proto.constructor.typename;
  }
  
  // Then check explicit Symbol markers with priority order
  const symbolOrder = ['Symbol', 'AstSymbol', 'Literal', 'Value', 'Node'];
  for (const name of symbolOrder) {
    if (node[SYMBOLS[name]] === true) {
      return name;
    }
  }
  
  // Fall back to any other symbol found
  for (const sym of Object.getOwnPropertySymbols(node)) {
    if (sym === NODE) continue;
    const desc = sym.toString();
    if (desc.startsWith('Symbol(') && desc.endsWith(')')) {
      const name = desc.slice(7, -1);
      if (node[sym] === true) {
        return name;
      }
    }
  }
  
  // Check REVERSE_SYMBOLS as fallback
  for (const [sym, name] of REVERSE_SYMBOLS) {
    if (sym !== NODE && node[sym] === true) {
      return name;
    }
  }
  
  if (node[NODE] === true) {
    return 'Node';
  }

  return undefined;
}

function traverseAndCheck(obj, symbol, results) {
  if (obj?.[symbol]) {
    results.push(obj);
  }

  if (obj?.children && Array.isArray(obj.children)) {
    obj.children.forEach(child => {
      if (child?.[NODE]) {
        traverseAndCheck(child, symbol, results);
      }
    });
  }
}

export function createNode(name, fields, initFn) {
  const typeSymbol = SYMBOLS[name];

  const nodeInit = function(lineno, colno, ...args) {
    this.lineno = lineno;
    this.colno = colno;
    this[NODE] = true;
    if (typeSymbol) this[typeSymbol] = true;

    fields.forEach((field, i) => {
      let val = args[i];
      if (val === undefined) {
        val = null;
      }
      this[field] = val;
    });

    if (initFn) {
      initFn.call(this, lineno, colno, ...args);
    }
  };

  const findAllMethod = function(typeOrSymbol, results) {
    results = results || [];

    let symbol = typeOrSymbol;
    if (typeof typeOrSymbol === 'function') {
      if (typeOrSymbol[NODE]) {
        symbol = NODE;
      } else if (typeOrSymbol.fields) {
        const name = typeOrSymbol.typename;
        symbol = SYMBOLS[name];
      }
    }

    if (this.children && Array.isArray(this.children)) {
      this.children.forEach(child => {
        if (child?.[NODE]) {
          traverseAndCheck(child, symbol, results);
        }
      });
    }

    return results;
  };

  const iterFieldsMethod = function(func) {
    if (this.fields) {
      this.fields.forEach((field) => {
        func(this[field], field);
      });
    }
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

  factoryFn.init = nodeInit;
  factoryFn.fields = fields;
  factoryFn.findAll = findAllMethod;
  factoryFn.iterFields = iterFieldsMethod;
  factoryFn.typename = name;
  factoryFn.extend = function(name, props) {
    const extended = extendObj(this, name, props);
    // Add Symbol marker for the extended type
    const extSymbol = Symbol(name);
    REVERSE_SYMBOLS.set(extSymbol, name);
    // Mark instances with this symbol
    const origInit = extended.init;
    extended.init = function(...args) {
      const result = origInit.apply(this, args);
      this[extSymbol] = true;
      return result;
    };
    return extended;
  };

  factoryFn[NODE] = true;
  if (typeSymbol) factoryFn[typeSymbol] = true;

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

export const Root = extendObjWithSymbol(NodeList, 'Root', {});
export const Literal = extendObjWithSymbol(Value, 'Literal', {});
export const LiteralNode = Literal;
export const AstSymbol = extendObjWithSymbol(Value, 'Symbol', {});
export const Group = extendObjWithSymbol(NodeList, 'Group', {});
export const ArrayNode = extendObjWithSymbol(NodeList, 'Array', {});
export const Pair = extendObjWithSymbol(Node, 'Pair', { fields: ['key', 'value'] });
export const Dict = extendObjWithSymbol(NodeList, 'Dict', {});
export const LookupVal = extendObjWithSymbol(Node, 'LookupVal', { fields: ['target', 'val'] });
export const OptionalChain = extendObjWithSymbol(Node, 'OptionalChain', { fields: ['target', 'val'] });
export const OptionalCall = extendObjWithSymbol(Node, 'OptionalCall', { fields: ['name', 'args'] });
export const Slice = extendObjWithSymbol(Node, 'Slice', { fields: ['start', 'stop', 'step'] });
export const If = extendObjWithSymbol(Node, 'If', { fields: ['cond', 'body', 'else_'] });
export const InlineIf = extendObjWithSymbol(Node, 'InlineIf', { fields: ['cond', 'body', 'else_'] });
export const For = extendObjWithSymbol(Node, 'For', { fields: ['arr', 'name', 'body', 'else_'] });
export const Macro = extendObjWithSymbol(Node, 'Macro', { fields: ['name', 'args', 'body'] });
export const Caller = extendObjWithSymbol(Macro, 'Caller', {});
export const Import = extendObjWithSymbol(Node, 'Import', { fields: ['template', 'target', 'withContext'] });

export const FromImport = createNode('FromImport', ['template', 'names', 'withContext'], function(lineno, colno, template, names, withContext) {
  if (!this.names) {
    this.names = NodeList(lineno, colno);
  }
});

export const FunCall = extendObjWithSymbol(Node, 'FunCall', { fields: ['name', 'args'] });
export const Pipe = extendObjWithSymbol(FunCall, 'Pipe', {});
export const PipeAsync = extendObjWithSymbol(Pipe, 'PipeAsync', { fields: ['symbol'] });
export const Filter = Pipe;
export const FilterAsync = PipeAsync;
export const KeywordArgs = extendObjWithSymbol(Dict, 'KeywordArgs', {});
export const Block = extendObjWithSymbol(Node, 'Block', { fields: ['name', 'body'] });
export const Super = extendObjWithSymbol(Node, 'Super', { fields: ['blockName', 'symbol'] });
export const TemplateRef = extendObjWithSymbol(Node, 'TemplateRef', { fields: ['template'] });
export const Extends = extendObjWithSymbol(TemplateRef, 'Extends', {});
export const Include = extendObjWithSymbol(Node, 'Include', { fields: ['template', 'ignoreMissing'] });
export const Set = extendObjWithSymbol(Node, 'Set', { fields: ['targets', 'value', 'operator'] });
export const Switch = extendObjWithSymbol(Node, 'Switch', { fields: ['expr', 'cases', 'default'] });
export const Case = extendObjWithSymbol(Node, 'Case', { fields: ['cond', 'body'] });
export const Output = extendObjWithSymbol(NodeList, 'Output', {});
export const Capture = extendObjWithSymbol(Node, 'Capture', { fields: ['body'] });
export const TemplateData = extendObjWithSymbol(LiteralNode, 'TemplateData', {});
export const UnaryOp = extendObjWithSymbol(Node, 'UnaryOp', { fields: ['target'] });
export const BinOp = extendObjWithSymbol(Node, 'BinOp', { fields: ['left', 'right'] });
export const In = extendObjWithSymbol(BinOp, 'In', {});
export const Is = extendObjWithSymbol(BinOp, 'Is', {});
export const Or = extendObjWithSymbol(BinOp, 'Or', {});
export const And = extendObjWithSymbol(BinOp, 'And', {});
export const NullishCoalesce = extendObjWithSymbol(BinOp, 'NullishCoalesce', {});
export const Not = extendObjWithSymbol(UnaryOp, 'Not', {});
export const Add = extendObjWithSymbol(BinOp, 'Add', {});
export const Concat = extendObjWithSymbol(BinOp, 'Concat', {});
export const Sub = extendObjWithSymbol(BinOp, 'Sub', {});
export const Mul = extendObjWithSymbol(BinOp, 'Mul', {});
export const Div = extendObjWithSymbol(BinOp, 'Div', {});
export const FloorDiv = extendObjWithSymbol(BinOp, 'FloorDiv', {});
export const Mod = extendObjWithSymbol(BinOp, 'Mod', {});
export const Pow = extendObjWithSymbol(BinOp, 'Pow', {});
export const Neg = extendObjWithSymbol(UnaryOp, 'Neg', {});
export const Pos = extendObjWithSymbol(UnaryOp, 'Pos', {});
export const Compare = extendObjWithSymbol(Node, 'Compare', { fields: ['expr', 'ops'] });
export const CompareOperand = extendObjWithSymbol(Node, 'CompareOperand', { fields: ['expr', 'type'] });
export const CallExtension = extendObjWithSymbol(Node, 'CallExtension', {
  fields: ['extName', 'prop', 'args', 'contentArgs'],
  init: function(ext, prop, args, contentArgs) {
    this.extName = ext.__name || ext;
    this.prop = prop;
    this.args = args || NodeList(0, 0);
    this.contentArgs = contentArgs || [];
    this.autoescape = ext.autoescape;
  }
});
export const CallExtensionAsync = extendObjWithSymbol(CallExtension, 'CallExtensionAsync', {});

export function isType(node, typeSymbol) {
  return node?.[typeSymbol] === true;
}

export const isNode = (obj) => obj?.[NODE] === true;
export const isLiteral = (obj) => obj?.[SYMBOLS.Literal] === true;
export const isSymbol = (obj) => obj?.[SYMBOLS.Symbol] === true;
export const isNodeList = (obj) => obj?.[SYMBOLS.NodeList] === true;
export const isOutput = (obj) => obj?.[SYMBOLS.Output] === true;
export const isFunCall = (obj) => obj?.[SYMBOLS.FunCall] === true;
export const isPipe = (obj) => obj?.[SYMBOLS.Pipe] === true;
export const isFilter = (obj) => obj?.[SYMBOLS.Filter] === true || obj?.[SYMBOLS.Pipe] === true;
export const isBlock = (obj) => obj?.[SYMBOLS.Block] === true;
export const isExtends = (obj) => obj?.[SYMBOLS.Extends] === true;
export const isInclude = (obj) => obj?.[SYMBOLS.Include] === true;
export const isMacro = (obj) => obj?.[SYMBOLS.Macro] === true;
export const isSet = (obj) => obj?.[SYMBOLS.Set] === true;
export const isIf = (obj) => obj?.[SYMBOLS.If] === true;
export const isFor = (obj) => obj?.[SYMBOLS.For] === true;
export const isCompare = (obj) => obj?.[SYMBOLS.Compare] === true;
export const isLookupVal = (obj) => obj?.[SYMBOLS.LookupVal] === true;
export const isCallExtension = (obj) => obj?.[SYMBOLS.CallExtension] === true;
export const isCallExtensionAsync = (obj) => obj?.[SYMBOLS.CallExtensionAsync] === true;
export const isDict = (obj) => obj?.[SYMBOLS.Dict] === true;
export const isArray = (obj) => obj?.[SYMBOLS.Array] === true;
export const isPair = (obj) => obj?.[SYMBOLS.Pair] === true;
export const isConcat = (obj) => obj?.[SYMBOLS.Concat] === true;
export const isAdd = (obj) => obj?.[SYMBOLS.Add] === true;
export const isBinOp = (obj) => obj?.[SYMBOLS.BinOp] === true;
export const isUnaryOp = (obj) => obj?.[SYMBOLS.UnaryOp] === true;
export const isKeywordArgs = (obj) => obj?.[SYMBOLS.KeywordArgs] === true;
export const isRoot = (obj) => obj?.[SYMBOLS.Root] === true;
export const isTemplateData = (obj) => obj?.[SYMBOLS.TemplateData] === true;
export const isSlice = (obj) => obj?.[SYMBOLS.Slice] === true;
export const isPipeAsync = (obj) => obj?.[SYMBOLS.PipeAsync] === true;
export const isOptionalChain = (obj) => obj?.[SYMBOLS.OptionalChain] === true;
export const isOptionalCall = (obj) => obj?.[SYMBOLS.OptionalCall] === true;
