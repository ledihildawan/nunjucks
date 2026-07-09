import {
  Node,
  NodeList,
  Root,
  Literal,
  AstSymbol,
  Group,
  Array as ArrayNode,
  Pair,
  Dict,
  LookupVal,
  OptionalChain,
  Slice,
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
  KeywordArgs,
  Block,
  Super,
  TemplateRef,
  Extends,
  Include,
  Set as AstSet,
  Switch,
  Case,
  Output,
  Capture,
  TemplateData,
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
  CallExtensionAsync,
} from '../nodes.js';

const CONSTRUCTOR_MAP = {
  NodeList,
  Root,
  Literal,
  Symbol: AstSymbol,
  Group,
  Array: ArrayNode,
  Pair,
  Dict,
  LookupVal,
  OptionalChain,
  Slice,
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
  Filter: Pipe,
  KeywordArgs,
  Block,
  Super,
  TemplateRef,
  Extends,
  Include,
  Set: AstSet,
  Switch,
  Case,
  Output,
  Capture,
  TemplateData,
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
  CallExtensionAsync,
};

export const mapCOW = (arr, func) => {
  let res = null;
  for (let i = 0; i < arr.length; i++) {
    const item = func(arr[i]);

    if (item !== arr[i]) {
      if (!res) {
        res = arr.slice();
      }
      res[i] = item;
    }
  }
  return res || arr;
};

export const walk = (ast, func, depthFirst) => {
  if (!(ast instanceof Node)) {
    return ast;
  }

  if (!depthFirst) {
    const astT = func(ast);
    if (astT && astT !== ast) {
      return astT;
    }
  }

  const Ctor = CONSTRUCTOR_MAP[ast.typename];
  if (!Ctor) {
    throw new Error(`walk: unknown typename ${ast.typename}`);
  }

  if (ast instanceof NodeList) {
    const children = mapCOW(ast.children, (node) => walk(node, func, depthFirst));
    if (children !== ast.children) {
      ast = new Ctor(ast.lineno, ast.colno, children);
    }
  } else if (ast instanceof CallExtension) {
    const args = walk(ast.args, func, depthFirst);
    const contentArgs = mapCOW(ast.contentArgs, (node) => walk(node, func, depthFirst));
    if (args !== ast.args || contentArgs !== ast.contentArgs) {
      ast = new Ctor(ast.extName, ast.prop, args, contentArgs);
    }
  } else {
    const props = ast.fields.map((field) => ast[field]);
    const propsT = mapCOW(props, (prop) => walk(prop, func, depthFirst));
    if (propsT !== props) {
      ast = new Ctor(ast.lineno, ast.colno);
      propsT.forEach((prop, i) => {
        ast[ast.fields[i]] = prop;
      });
    }
  }

  return depthFirst ? (func(ast) || ast) : ast;
};

export const depthWalk = (ast, func) => walk(ast, func, true);
