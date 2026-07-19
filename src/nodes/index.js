// ============================================
// FP Pattern - AST Nodes
// Pure functions, plain objects, string types
// ============================================

// ============================================
// NODE TYPES - String constants
// ============================================
export const BracketNotation = Symbol('BracketNotation');

export const NODE_TYPES = Object.freeze({
  NODE: 'node',
  VALUE: 'value',
  LITERAL: 'literal',
  SYMBOL: 'symbol',
  NODE_LIST: 'nodeList',
  OUTPUT: 'output',
  FUN_CALL: 'funCall',
  PIPE: 'pipe',
  FILTER: 'filter',
  BLOCK: 'block',
  EXTENDS: 'extends',
  INCLUDE: 'include',
  MACRO: 'macro',
  SET: 'set',
  IF: 'if',
  FOR: 'for',
  COMPARE: 'compare',
  LOOKUP_VAL: 'lookupVal',
  CALL_EXTENSION: 'callExtension',
  CALL_EXTENSION_ASYNC: 'callExtensionAsync',
  DICT: 'dict',
  ARRAY: 'array',
  PAIR: 'pair',
  CONCAT: 'concat',
  ADD: 'add',
  BIN_OP: 'binOp',
  UNARY_OP: 'unaryOp',
  KEYWORD_ARGS: 'keywordArgs',
  ROOT: 'root',
  SLICE: 'slice',
  GROUP: 'group',
  TEMPLATE_DATA: 'templateData',
  INLINE_IF: 'inlineIf',
  OR: 'or',
  AND: 'and',
  NOT: 'not',
  COMPARE_OPERAND: 'compareOperand',
  SUB: 'sub',
  MUL: 'mul',
  DIV: 'div',
  FLOOR_DIV: 'floorDiv',
  MOD: 'mod',
  POW: 'pow',
  NEG: 'neg',
  POS: 'pos',
  SUPER: 'super',
  TEMPLATE_REF: 'templateRef',
  IMPORT: 'import',
  FROM_IMPORT: 'fromImport',
  SWITCH: 'switch',
  CASE: 'case',
  CAPTURE: 'capture',
  CALLER: 'caller',
  CALL: 'call',
  OPTIONAL_CHAIN: 'optionalChain',
  OPTIONAL_CALL: 'optionalCall',
  PIPE_ASYNC: 'pipeAsync',
  NULLISH_COALESCE: 'nullishCoalesce',
  IN: 'in',
  TRY_CATCH: 'tryCatch',
  DO: 'do',
  WITH: 'with',
  IS: 'is',
  SPREAD: 'spread',
  WALRUS: 'walrus',
  TEMPLATE_LITERAL: 'templateLiteral',
});

// ============================================
// PURE FACTORY FUNCTIONS
// ============================================

// Base creators
const createNode = (nodeType, lineno, colno, data = {}) => {
  const node = { type: nodeType, lineno, colno, ...data };
  node.fields = Object.keys(data);
  node.findAll = function(findType) {
    const results = [];
    const seen = new Set();
    const checkNode = (n) => {
      if (!n || seen.has(n)) return;
      seen.add(n);
      if (typeof findType === 'string') {
        if (n.type === findType) results.push(n);
      } else if (typeof findType === 'function') {
        if (findType(n)) results.push(n);
      }
      if (n.children && Array.isArray(n.children)) {
        n.children.forEach(checkNode);
      }
      if (n.fields) {
        n.fields.forEach(field => {
          const val = n[field];
          if (val && typeof val === 'object') {
            if (Array.isArray(val)) {
              val.forEach(checkNode);
            } else {
              checkNode(val);
            }
          }
        });
      }
    };
    checkNode(this);
    return results;
  };
  node.iterFields = function(func) {
    this.fields.forEach(field => func(this[field], field));
  };
  return node;
};

const createNodeWithChildren = (nodeType, lineno, colno, children = []) => {
  const node = { type: nodeType, lineno, colno, children: children || [] };
  node.fields = ['children'];
  node.findAll = function(findType) {
    const results = [];
    const seen = new Set();
    const checkNode = (n) => {
      if (!n || seen.has(n)) return;
      seen.add(n);
      if (typeof findType === 'string') {
        if (n.type === findType) results.push(n);
      } else if (typeof findType === 'function') {
        if (findType(n)) results.push(n);
      }
      if (n.children && Array.isArray(n.children)) {
        n.children.forEach(checkNode);
      }
      if (n.fields) {
        n.fields.forEach(field => {
          const val = n[field];
          if (val && typeof val === 'object') {
            if (Array.isArray(val)) {
              val.forEach(checkNode);
            } else {
              checkNode(val);
            }
          }
        });
      }
    };
    checkNode(this);
    return results;
  };
  node.iterFields = function(func) {
    this.fields.forEach(field => func(this[field], field));
  };
  node.addChild = function(child) {
    this.children.push(child);
  };
  return node;
};

// Node creators
export const node = (lineno, colno) => createNode(NODE_TYPES.NODE, lineno, colno);
export const value = (lineno, colno, val) => createNode(NODE_TYPES.VALUE, lineno, colno, { value: val });
export const nodeList = (lineno, colno, children = []) => createNodeWithChildren(NODE_TYPES.NODE_LIST, lineno, colno, children);
export const output = (lineno, colno, children = []) => createNodeWithChildren(NODE_TYPES.OUTPUT, lineno, colno, children);
export const root = (lineno, colno, children = []) => createNodeWithChildren(NODE_TYPES.ROOT, lineno, colno, children);

// Expression nodes
export const literal = (lineno, colno, val) => createNode(NODE_TYPES.LITERAL, lineno, colno, { value: val });
export const symbol = (lineno, colno, val) => createNode(NODE_TYPES.SYMBOL, lineno, colno, { value: val });
export const templateData = (lineno, colno, val) => createNode(NODE_TYPES.TEMPLATE_DATA, lineno, colno, { value: val });

// Function call nodes
export const funCall = (lineno, colno, name, args = []) =>
  createNode(NODE_TYPES.FUN_CALL, lineno, colno, { name, args: args || [] });

export const pipe = (lineno, colno, name, args = []) =>
  createNode(NODE_TYPES.PIPE, lineno, colno, { name, args: args || [] });

export const pipeAsync = (lineno, colno, name, args = [], symbol_) =>
  createNode(NODE_TYPES.PIPE_ASYNC, lineno, colno, { name, args: args || [], symbol: symbol_ });

// Lookup nodes
export const lookupVal = (lineno, colno, target, val) => 
  createNode(NODE_TYPES.LOOKUP_VAL, lineno, colno, { target, val });

export const slice = (lineno, colno, start, stop, step) => 
  createNode(NODE_TYPES.SLICE, lineno, colno, { start, stop, step });

export const optionalChain = (lineno, colno, target, val) => 
  createNode(NODE_TYPES.OPTIONAL_CHAIN, lineno, colno, { target, val });

export const optionalCall = (lineno, colno, name, args = []) =>
  createNode(NODE_TYPES.OPTIONAL_CALL, lineno, colno, { name, args: args || [] });

// Binary operations
export const add = (lineno, colno, left, right) => createNode(NODE_TYPES.ADD, lineno, colno, { left, right, operator: '+' });
export const sub = (lineno, colno, left, right) => createNode(NODE_TYPES.SUB, lineno, colno, { left, right, operator: '-' });
export const mul = (lineno, colno, left, right) => createNode(NODE_TYPES.MUL, lineno, colno, { left, right, operator: '*' });
export const div = (lineno, colno, left, right) => createNode(NODE_TYPES.DIV, lineno, colno, { left, right, operator: '/' });
export const floorDiv = (lineno, colno, left, right) => createNode(NODE_TYPES.FLOOR_DIV, lineno, colno, { left, right, operator: '//' });
export const mod = (lineno, colno, left, right) => createNode(NODE_TYPES.MOD, lineno, colno, { left, right, operator: '%' });
export const pow = (lineno, colno, left, right) => createNode(NODE_TYPES.POW, lineno, colno, { left, right, operator: '**' });
export const concat = (lineno, colno, left, right) => createNode(NODE_TYPES.CONCAT, lineno, colno, { left, right });

export const binOp = (type) => (lineno, colno, left, right, operator) =>
  createNode(type, lineno, colno, { left, right, operator });

export const unaryOp = (type) => (lineno, colno, target, operator) =>
  createNode(type, lineno, colno, { target, operator });

// Unary operations
export const not = (lineno, colno, target) => createNode(NODE_TYPES.NOT, lineno, colno, { target, operator: 'not' });
export const neg = (lineno, colno, target) => createNode(NODE_TYPES.NEG, lineno, colno, { target, operator: '-' });
export const pos = (lineno, colno, target) => createNode(NODE_TYPES.POS, lineno, colno, { target, operator: '+' });

// Logical operations
export const and = (lineno, colno, left, right) => createNode(NODE_TYPES.AND, lineno, colno, { left, right });
export const or = (lineno, colno, left, right) => createNode(NODE_TYPES.OR, lineno, colno, { left, right });
export const nullishCoalesce = (lineno, colno, left, right) => createNode(NODE_TYPES.NULLISH_COALESCE, lineno, colno, { left, right });

// Comparison operations
export const compare = (lineno, colno, expr, ops = []) =>
  createNode(NODE_TYPES.COMPARE, lineno, colno, { expr, ops: ops || [] });

export const compareOperand = (lineno, colno, expr, operator) => 
  createNode(NODE_TYPES.COMPARE_OPERAND, lineno, colno, { expr, operator });

// Type checks
export const is = (lineno, colno, left, right) => createNode(NODE_TYPES.IS, lineno, colno, { left, right });
export const in_ = (lineno, colno, left, right) => createNode(NODE_TYPES.IN, lineno, colno, { left, right });

// Statement nodes
export const block = (...args) => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, name, body] = args;
    return createNode(NODE_TYPES.BLOCK, lineno, colno, { name, body });
  }
  const [lineno, colno] = args;
  return createNode(NODE_TYPES.BLOCK, lineno, colno, {});
}

export const if_ = (...args) => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, cond, body, else__ = null] = args;
    return createNode(NODE_TYPES.IF, lineno, colno, { cond, body, else_: else__ });
  }
  const [lineno, colno] = args;
  return createNode(NODE_TYPES.IF, lineno, colno, { else_: null });
}

export const inlineIf = (...args) => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, cond, body, else__ = null] = args;
    return createNode(NODE_TYPES.INLINE_IF, lineno, colno, { cond, body, else_: else__ });
  }
  const [lineno, colno] = args;
  return createNode(NODE_TYPES.INLINE_IF, lineno, colno, { else_: null });
}

export const for_ = (...args) => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, arr, name, body, else__ = null] = args;
    return createNode(NODE_TYPES.FOR, lineno, colno, { arr, name, body, else_: else__ });
  }
  const [lineno, colno] = args;
  return createNode(NODE_TYPES.FOR, lineno, colno, { else_: null });
}

export const macro = (lineno, colno, name, args, body) =>
  createNode(NODE_TYPES.MACRO, lineno, colno, { name, args: args || [], body });

export const caller = (lineno, colno, args, body) =>
  createNode(NODE_TYPES.CALLER, lineno, colno, { args: args || [], body });

export const call = (lineno, colno, name, args, body) =>
  createNode(NODE_TYPES.CALL, lineno, colno, { name, args: args || [], body });

export const import_ = (lineno, colno, template, target, withContext = false) => 
  createNode(NODE_TYPES.IMPORT, lineno, colno, { template, target, withContext });

export const fromImport = (lineno, colno, template, names = undefined, withContext = false) =>
  createNode(NODE_TYPES.FROM_IMPORT, lineno, colno, { template, names: names || nodeList(0, 0), withContext });

export const set = (...args) => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, targets = [], val, operator = null] = args;
    return createNode(NODE_TYPES.SET, lineno, colno, { targets: targets || [], value: val, operator });
  }
  const [lineno, colno] = args;
  return createNode(NODE_TYPES.SET, lineno, colno, { targets: [] });
}

export const capture = (lineno, colno, body) =>
  createNode(NODE_TYPES.CAPTURE, lineno, colno, { body });

export const tryCatch = (lineno, colno, body, catchBody = null, errVar = null) =>
  createNode(NODE_TYPES.TRY_CATCH, lineno, colno, { body, catch: catchBody, errVar });

export const do_ = (lineno, colno, expr) =>
  createNode(NODE_TYPES.DO, lineno, colno, { expr });

export const with_ = (lineno, colno, assignments = [], body = null) =>
  createNode(NODE_TYPES.WITH, lineno, colno, { assignments, body });

export const switch_ = (lineno, colno, expr, cases = [], default_ = null) =>
  createNode(NODE_TYPES.SWITCH, lineno, colno, { expr, cases: cases || [], default: default_ });

export const case_ = (lineno, colno, cond, body) => 
  createNode(NODE_TYPES.CASE, lineno, colno, { cond, body });

// Template reference nodes
export const templateRef = (lineno, colno, template) => 
  createNode(NODE_TYPES.TEMPLATE_REF, lineno, colno, { template });

export const extends_ = (...args) => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, template] = args;
    return createNode(NODE_TYPES.EXTENDS, lineno, colno, { template });
  }
  const [lineno, colno] = args;
  return createNode(NODE_TYPES.EXTENDS, lineno, colno, {});
}

export const include = (...args) => {
  if (typeof args[0] === 'number') {
    const [lineno, colno, template, ignoreMissing = null] = args;
    return createNode(NODE_TYPES.INCLUDE, lineno, colno, { template, ignoreMissing });
  }
  const [lineno, colno] = args;
  return createNode(NODE_TYPES.INCLUDE, lineno, colno, { ignoreMissing: null });
}

export const super_ = (lineno, colno, blockName, sym = null) =>
  createNode(NODE_TYPES.SUPER, lineno, colno, { blockName, symbol: sym });

// Aggregate nodes
export const group = (lineno, colno, children = []) => 
  createNodeWithChildren(NODE_TYPES.GROUP, lineno, colno, children);

export const array = (lineno, colno, children = []) => 
  createNodeWithChildren(NODE_TYPES.ARRAY, lineno, colno, children);

export const dict = (lineno, colno, children = []) => 
  createNodeWithChildren(NODE_TYPES.DICT, lineno, colno, children);

export const pair = (lineno, colno, key, val) =>
  createNode(NODE_TYPES.PAIR, lineno, colno, { key, value: val });

export const spread = (lineno, colno, argument) =>
  createNode(NODE_TYPES.SPREAD, lineno, colno, { argument });

export const walrus = (lineno, colno, target, val) =>
  createNode(NODE_TYPES.WALRUS, lineno, colno, { target, value: val });

export const templateLiteral = (lineno, colno, quasis) =>
  createNode(NODE_TYPES.TEMPLATE_LITERAL, lineno, colno, { quasis: quasis || [] });

export const keywordArgs = (lineno, colno, children = []) => 
  createNodeWithChildren(NODE_TYPES.KEYWORD_ARGS, lineno, colno, children);

// Extension nodes - support both (lineno, colno, ext, prop, args, contentArgs) and (ext, prop, args, contentArgs)
export const callExtension = (...args) => {
  let lineno, colno, ext, prop;
  
  if (typeof args[0] === 'number') {
    [lineno, colno, ext, prop] = args;
  } else {
    [ext, prop] = args;
    lineno = 0;
    colno = 0;
  }
  
  const nodeArgs = args[2] !== undefined ? args[2] : nodeList(0, 0);
  const nodeContentArgs = args[3] !== undefined ? args[3] : [];
  
  return createNode(NODE_TYPES.CALL_EXTENSION, lineno, colno, {
    extName: ext?.__name || ext,
    prop,
    args: nodeArgs,
    contentArgs: nodeContentArgs,
    autoescape: ext?.autoescape ?? true
  });
};

export const callExtensionAsync = (...args) => {
  let lineno, colno, ext, prop;
  
  if (typeof args[0] === 'number') {
    [lineno, colno, ext, prop] = args;
  } else {
    [ext, prop] = args;
    lineno = 0;
    colno = 0;
  }
  
  const nodeArgs = args[2] !== undefined ? args[2] : nodeList(0, 0);
  const nodeContentArgs = args[3] !== undefined ? args[3] : [];
  
  return createNode(NODE_TYPES.CALL_EXTENSION_ASYNC, lineno, colno, {
    extName: ext?.__name || ext,
    prop,
    args: nodeArgs,
    contentArgs: nodeContentArgs,
    autoescape: ext?.autoescape ?? true
  });
};

// Aliases for backward compatibility naming
export const Filter = pipe;
export const FilterAsync = pipeAsync;
export const LiteralNode = literal;

// ============================================
// PURE TYPE GUARDS
// ============================================
export const isNode = (n) => n?.type && Object.values(NODE_TYPES).includes(n.type);
export const isValue = (n) => n?.type === NODE_TYPES.VALUE;
export const isLiteral = (n) => n?.type === NODE_TYPES.LITERAL;
export const isSymbol = (n) => n?.type === NODE_TYPES.SYMBOL;
export const isNodeList = (n) => n?.type === NODE_TYPES.NODE_LIST;
export const isOutput = (n) => n?.type === NODE_TYPES.OUTPUT;
export const isFunCall = (n) => n?.type === NODE_TYPES.FUN_CALL;
export const isPipe = (n) => n?.type === NODE_TYPES.PIPE;
export const isFilter = (n) => n?.type === NODE_TYPES.FILTER || n?.type === NODE_TYPES.PIPE;
export const isBlock = (n) => n?.type === NODE_TYPES.BLOCK;
export const isExtends = (n) => n?.type === NODE_TYPES.EXTENDS;
export const isInclude = (n) => n?.type === NODE_TYPES.INCLUDE;
export const isMacro = (n) => n?.type === NODE_TYPES.MACRO;
export const isSet = (n) => n?.type === NODE_TYPES.SET;
export const isIf = (n) => n?.type === NODE_TYPES.IF;
export const isFor = (n) => n?.type === NODE_TYPES.FOR;
export const isCompare = (n) => n?.type === NODE_TYPES.COMPARE;
export const isLookupVal = (n) => n?.type === NODE_TYPES.LOOKUP_VAL;
export const isCallExtension = (n) => n?.type === NODE_TYPES.CALL_EXTENSION;
export const isCallExtensionAsync = (n) => n?.type === NODE_TYPES.CALL_EXTENSION_ASYNC;
export const isDict = (n) => n?.type === NODE_TYPES.DICT;
export const isArray = (n) => n?.type === NODE_TYPES.ARRAY;
export const isPair = (n) => n?.type === NODE_TYPES.PAIR;
export const isConcat = (n) => n?.type === NODE_TYPES.CONCAT;
export const isAdd = (n) => n?.type === NODE_TYPES.ADD;
export const isBinOp = (n) => n?.type === NODE_TYPES.BIN_OP;
export const isUnaryOp = (n) => n?.type === NODE_TYPES.UNARY_OP;
export const isKeywordArgs = (n) => n?.type === NODE_TYPES.KEYWORD_ARGS;
export const isRoot = (n) => n?.type === NODE_TYPES.ROOT;
export const isTemplateData = (n) => n?.type === NODE_TYPES.TEMPLATE_DATA;
export const isSlice = (n) => n?.type === NODE_TYPES.SLICE;
export const isPipeAsync = (n) => n?.type === NODE_TYPES.PIPE_ASYNC;
export const isOptionalChain = (n) => n?.type === NODE_TYPES.OPTIONAL_CHAIN;
export const isOptionalCall = (n) => n?.type === NODE_TYPES.OPTIONAL_CALL;
export const isImport = (n) => n?.type === NODE_TYPES.IMPORT;
export const isFromImport = (n) => n?.type === NODE_TYPES.FROM_IMPORT;
export const isSwitch = (n) => n?.type === NODE_TYPES.SWITCH;
export const isCase = (n) => n?.type === NODE_TYPES.CASE;
export const isCapture = (n) => n?.type === NODE_TYPES.CAPTURE;
export const isTryCatch = (n) => n?.type === NODE_TYPES.TRY_CATCH;
export const isDo = (n) => n?.type === NODE_TYPES.DO;
export const isWith = (n) => n?.type === NODE_TYPES.WITH;
export const isCaller = (n) => n?.type === NODE_TYPES.CALLER;
export const isCall = (n) => n?.type === NODE_TYPES.CALL;
export const isSuper = (n) => n?.type === NODE_TYPES.SUPER;
export const isTemplateRef = (n) => n?.type === NODE_TYPES.TEMPLATE_REF;
export const isInlineIf = (n) => n?.type === NODE_TYPES.INLINE_IF;
export const isOr = (n) => n?.type === NODE_TYPES.OR;
export const isAnd = (n) => n?.type === NODE_TYPES.AND;
export const isNot = (n) => n?.type === NODE_TYPES.NOT;
export const isNullishCoalesce = (n) => n?.type === NODE_TYPES.NULLISH_COALESCE;
export const isCompareOperand = (n) => n?.type === NODE_TYPES.COMPARE_OPERAND;
export const isIn = (n) => n?.type === NODE_TYPES.IN;
export const isIs = (n) => n?.type === NODE_TYPES.IS;
export const isSpread = (n) => n?.type === NODE_TYPES.SPREAD;
export const isWalrus = (n) => n?.type === NODE_TYPES.WALRUS;
export const isTemplateLiteral = (n) => n?.type === NODE_TYPES.TEMPLATE_LITERAL;
export const isGroup = (n) => n?.type === NODE_TYPES.GROUP;
export const isSub = (n) => n?.type === NODE_TYPES.SUB;
export const isMul = (n) => n?.type === NODE_TYPES.MUL;
export const isDiv = (n) => n?.type === NODE_TYPES.DIV;
export const isFloorDiv = (n) => n?.type === NODE_TYPES.FLOOR_DIV;
export const isMod = (n) => n?.type === NODE_TYPES.MOD;
export const isPow = (n) => n?.type === NODE_TYPES.POW;
export const isNeg = (n) => n?.type === NODE_TYPES.NEG;
export const isPos = (n) => n?.type === NODE_TYPES.POS;

// ============================================
// HELPERS
// ============================================
export const getNodeTypeName = (n) => n?.type ?? undefined;

export const getNodeFields = (n) => {
  const excluded = ['type', 'lineno', 'colno', 'fields', 'findAll', 'iterFields', 'addChild'];
  if (!n) return [];
  return Object.keys(n).filter(key => !excluded.includes(key));
};

export const addChild = (list, child) => {
  if (!list || !list.children) return list;
  list.children.push(child);
  return list;
};

// ============================================
// GROUPED NAMESPACE
// ============================================
export const nodes = Object.freeze({
  // Types
  NODE_TYPES,

  // Base creators
  node,
  value,
  nodeList,
  output,
  root,

  // Expression creators
  literal,
  symbol,
  templateData,

  // Function call creators
  funCall,
  pipe,
  pipeAsync,

  // Lookup creators
  lookupVal,
  slice,
  optionalChain,
  optionalCall,

  // Binary operation creators
  add,
  sub,
  mul,
  div,
  floorDiv,
  mod,
  pow,
  concat,
  binOp,

  // Unary operation creators
  unaryOp,
  not,
  neg,
  pos,

  // Logical creators
  and,
  or,
  nullishCoalesce,

  // Comparison creators
  compare,
  compareOperand,

  // Type check creators
  is,
  in: in_,

  // Statement creators
  block,
  if: if_,
  inlineIf,
  for: for_,
  macro,
  caller,
  call,
  import: import_,
  fromImport,
  set,
  capture,
  tryCatch,
  do: do_,
  with: with_,
  switch: switch_,
  case: case_,

  // Template reference creators
  templateRef,
  extends: extends_,
  include,
  super: super_,

  // Aggregate creators
  group,
  array,
  dict,
  pair,
  spread,
  walrus,
  templateLiteral,
  keywordArgs,

  // Extension creators
  callExtension,
  callExtensionAsync,

  // Aliases
  Filter,
  FilterAsync,
  LiteralNode,

  // Type guards
  isNode,
  isValue,
  isLiteral,
  isSymbol,
  isNodeList,
  isOutput,
  isFunCall,
  isPipe,
  isFilter,
  isBlock,
  isExtends,
  isInclude,
  isMacro,
  isSet,
  isIf,
  isFor,
  isCompare,
  isLookupVal,
  isCallExtension,
  isCallExtensionAsync,
  isDict,
  isArray,
  isPair,
  isConcat,
  isAdd,
  isBinOp,
  isUnaryOp,
  isKeywordArgs,
  isRoot,
  isTemplateData,
  isSlice,
  isPipeAsync,
  isOptionalChain,
  isOptionalCall,
  isImport,
  isFromImport,
  isSwitch,
  isCase,
  isCapture,
  isTryCatch,
  isDo,
  isWith,
  isCaller,
  isCall,
  isSuper,
  isTemplateRef,
  isInlineIf,
  isOr,
  isAnd,
  isNot,
  isNullishCoalesce,
  isCompareOperand,
  isIn,
  isIs,
  isSpread,
  isWalrus,
  isTemplateLiteral,
  isGroup,
  isSub,
  isMul,
  isDiv,
  isFloorDiv,
  isMod,
  isPow,
  isNeg,
  isPos,

  // Helpers
  getNodeTypeName,
  getNodeFields,
  addChild,

  // Generic creator
  createNode,
});
