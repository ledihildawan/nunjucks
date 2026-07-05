import {Obj} from './object.js';

function traverseAndCheck(obj, type, results) {
  if (obj instanceof type) {
    results.push(obj);
  }

  if (obj instanceof Node) {
    obj.findAll(type, results);
  }
}

export class Node extends Obj {
  init(lineno, colno, ...args) {
    this.lineno = lineno;
    this.colno = colno;

    this.fields.forEach((field, i) => {
      var val = arguments[i + 2];

      if (val === undefined) {
        val = null;
      }

      this[field] = val;
    });
  }

  findAll(type, results) {
    results = results || [];

    if (this instanceof NodeList) {
      this.children.forEach(child => traverseAndCheck(child, type, results));
    } else {
      this.fields.forEach(field => traverseAndCheck(this[field], type, results));
    }

    return results;
  }

  iterFields(func) {
    this.fields.forEach((field) => {
      func(this[field], field);
    });
  }
}

export class Value extends Node {
  get typename() { return 'Value'; }
  get fields() {
    return ['value'];
  }
}

export class NodeList extends Node {
  get typename() { return 'NodeList'; }
  get fields() { return ['children']; }

  init(lineno, colno, nodes) {
    super.init(lineno, colno, nodes || []);
  }

  addChild(node) {
    this.children.push(node);
  }
}

export const Root = NodeList.extend('Root');
export const Literal = Value.extend('Literal');
export const Symbol = Value.extend('Symbol');
export const Group = NodeList.extend('Group');
export const ArrayNode = NodeList.extend('Array');
export const Array = ArrayNode;
export const Pair = Node.extend('Pair', { fields: ['key', 'value'] });
export const Dict = NodeList.extend('Dict');
export const LookupVal = Node.extend('LookupVal', { fields: ['target', 'val'] });
export const OptionalChain = Node.extend('OptionalChain', { fields: ['target', 'val'] });
export const Slice = Node.extend('Slice', { fields: ['start', 'stop', 'step'] });
export const If = Node.extend('If', { fields: ['cond', 'body', 'else_'] });
export const IfAsync = If.extend('IfAsync');
export const InlineIf = Node.extend('InlineIf', { fields: ['cond', 'body', 'else_'] });
export const For = Node.extend('For', { fields: ['arr', 'name', 'body', 'else_'] });
export const AsyncEach = For.extend('AsyncEach');
export const AsyncAll = For.extend('AsyncAll');
export const Macro = Node.extend('Macro', { fields: ['name', 'args', 'body'] });
export const Caller = Macro.extend('Caller');
export const Import = Node.extend('Import', { fields: ['template', 'target', 'withContext'] });

export class FromImport extends Node {
  get typename() { return 'FromImport'; }
  get fields() { return ['template', 'names', 'withContext']; }

  init(lineno, colno, template, names, withContext) {
    super.init(lineno, colno, template, names || new NodeList(), withContext);
  }
}

export const FunCall = Node.extend('FunCall', { fields: ['name', 'args'] });
export const Pipe = FunCall.extend('Pipe');
export const PipeAsync = Pipe.extend('PipeAsync', { fields: ['name', 'args', 'symbol'] });
export const Filter = Pipe;
export const FilterAsync = PipeAsync;
export const KeywordArgs = Dict.extend('KeywordArgs');
export const Block = Node.extend('Block', { fields: ['name', 'body'] });
export const Super = Node.extend('Super', { fields: ['blockName', 'symbol'] });
export const TemplateRef = Node.extend('TemplateRef', { fields: ['template'] });
export const Extends = TemplateRef.extend('Extends');
export const Include = Node.extend('Include', { fields: ['template', 'ignoreMissing'] });
export const Set = Node.extend('Set', { fields: ['targets', 'value', 'operator'] });
export const Switch = Node.extend('Switch', { fields: ['expr', 'cases', 'default'] });
export const Case = Node.extend('Case', { fields: ['cond', 'body'] });
export const Output = NodeList.extend('Output');
export const Capture = Node.extend('Capture', { fields: ['body'] });
export const TemplateData = Literal.extend('TemplateData');
export const UnaryOp = Node.extend('UnaryOp', { fields: ['target'] });
export const BinOp = Node.extend('BinOp', { fields: ['left', 'right'] });
export const In = BinOp.extend('In');
export const Is = BinOp.extend('Is');
export const Or = BinOp.extend('Or');
export const And = BinOp.extend('And');
export const NullishCoalesce = BinOp.extend('NullishCoalesce');
export const Not = UnaryOp.extend('Not');
export const Add = BinOp.extend('Add');
export const Concat = BinOp.extend('Concat');
export const Sub = BinOp.extend('Sub');
export const Mul = BinOp.extend('Mul');
export const Div = BinOp.extend('Div');
export const FloorDiv = BinOp.extend('FloorDiv');
export const Mod = BinOp.extend('Mod');
export const Pow = BinOp.extend('Pow');
export const Neg = UnaryOp.extend('Neg');
export const Pos = UnaryOp.extend('Pos');
export const Compare = Node.extend('Compare', { fields: ['expr', 'ops'] });
export const CompareOperand = Node.extend('CompareOperand', { fields: ['expr', 'type'] });
export const CallExtension = Node.extend('CallExtension', {
  init(ext, prop, args, contentArgs) {
    this.parent();
    this.extName = ext.__name || ext;
    this.prop = prop;
    this.args = args || new NodeList();
    this.contentArgs = contentArgs || [];
    this.autoescape = ext.autoescape;
  },
  fields: ['extName', 'prop', 'args', 'contentArgs']
});
export const CallExtensionAsync = CallExtension.extend('CallExtensionAsync');

export default {
  Node,
  Root,
  NodeList,
  Value,
  Literal,
  Symbol,
  Group,
  Array: ArrayNode,
  Pair,
  Dict,
  Output,
  Capture,
  TemplateData,
  If,
  IfAsync,
  InlineIf,
  For,
  AsyncEach,
  AsyncAll,
  Macro,
  Caller,
  Import,
  FromImport,
  FunCall,
  Pipe,
  PipeAsync,
  Filter,
  FilterAsync,
  KeywordArgs,
  Block,
  Super,
  Extends,
  Include,
  Set,
  Switch,
  Case,
  LookupVal,
  OptionalChain,
  Slice,
  BinOp,
  In,
  Is,
  Or,
  And,
  NullishCoalesce,
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
  CompareOperand,
  CallExtension,
  CallExtensionAsync
};
