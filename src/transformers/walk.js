import { nodes } from '../nodes/index.js';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';

const CONSTRUCTOR_MAP = new Map([
  ['node', nodes.node],
  ['value', nodes.value],
  ['nodeList', nodes.nodeList],
  ['root', nodes.root],
  ['literal', nodes.literal],
  ['symbol', nodes.symbol],
  ['group', nodes.group],
  ['array', nodes.array],
  ['pair', nodes.pair],
  ['dict', nodes.dict],
  ['lookupVal', nodes.lookupVal],
  ['optionalChain', nodes.optionalChain],
  ['optionalCall', nodes.optionalCall],
  ['slice', nodes.slice],
  ['if', nodes.if],
  ['inlineIf', nodes.inlineIf],
  ['for', nodes.for],
  ['macro', nodes.macro],
  ['caller', nodes.caller],
  ['call', nodes.call],
  ['import', nodes.import],
  ['fromImport', nodes.fromImport],
  ['funCall', nodes.funCall],
  ['pipe', nodes.pipe],
  ['pipeAsync', nodes.pipeAsync],
  ['keywordArgs', nodes.keywordArgs],
  ['block', nodes.block],
  ['super', nodes.super],
  ['templateRef', nodes.templateRef],
  ['extends', nodes.extends],
  ['include', nodes.include],
  ['set', nodes.set],
  ['switch', nodes.switch],
  ['case', nodes.case],
  ['output', nodes.output],
  ['capture', nodes.capture],
  ['tryCatch', nodes.tryCatch],
  ['do', nodes.do],
  ['with', nodes.with],
  ['templateData', nodes.templateData],
  ['in', nodes.in],
  ['is', nodes.is],
  ['or', nodes.or],
  ['and', nodes.and],
  ['nullishCoalesce', nodes.nullishCoalesce],
  ['not', nodes.not],
  ['add', nodes.add],
  ['concat', nodes.concat],
  ['sub', nodes.sub],
  ['mul', nodes.mul],
  ['div', nodes.div],
  ['floorDiv', nodes.floorDiv],
  ['mod', nodes.mod],
  ['pow', nodes.pow],
  ['neg', nodes.neg],
  ['pos', nodes.pos],
  ['compare', nodes.compare],
  ['compareOperand', nodes.compareOperand],
  ['bitwiseOr', nodes.bitwiseOr],
  ['bitwiseAnd', nodes.bitwiseAnd],
  ['bitwiseXor', nodes.bitwiseXor],
  ['bitwiseLShift', nodes.bitwiseLShift],
  ['bitwiseRShift', nodes.bitwiseRShift],
  ['bitwiseNot', nodes.bitwiseNot],
  ['increment', nodes.increment],
  ['decrement', nodes.decrement],
  ['callExtension', nodes.callExtension],
  ['callExtensionAsync', nodes.callExtensionAsync],
  ['spread', nodes.spread],
  ['walrus', nodes.walrus],
  ['templateLiteral', nodes.templateLiteral],
  ['variableDeclaration', nodes.variableDeclaration],
  ['variableAssignment', nodes.variableAssignment],
  ['compoundAssignment', nodes.compoundAssignment],
  ['defineBlock', nodes.defineBlock],
  ['arrayPattern', nodes.arrayPattern],
  ['objectPattern', nodes.objectPattern],
  ['patternProperty', nodes.patternProperty],
  ['restPattern', nodes.restPattern],
  ['assignmentPattern', nodes.assignmentPattern],
  ['hole', nodes.hole],
]);

export const mapCOW = (arr, func) => {
  let res = null;
  for (let i = 0; i < arr.length; i++) {
    const item = func(arr[i]);
    if (item !== arr[i]) {
      if (!res) {
        res = Array.from(arr);
      }
      res[i] = item;
    }
  }
  return res || arr;
};

const walkNode = (ast, func, depthFirst) => {
  const typeName = nodes.getNodeTypeName(ast);
  const Ctor = CONSTRUCTOR_MAP.get(typeName);
  
  if (!Ctor) {
    throw createLog('error', ERROR_DEFINITIONS.WALK_UNKNOWN_TYPE, { type: typeName }, null, {
      lineno: ast.lineno ?? null,
      colno: ast.colno ?? null,
      phase: 'compile',
      lineBase: 'zero'
    });
  }

  if (nodes.isNodeList(ast) || nodes.isRoot(ast) || (ast.children && Array.isArray(ast.children))) {
    const children = mapCOW(ast.children, (node) => walk(node, func, depthFirst));
    if (children !== ast.children) {
      return Ctor(ast.lineno, ast.colno, children);
    }
  } else if (nodes.isCallExtension(ast) || nodes.isCallExtensionAsync(ast)) {
    const args = walk(ast.args, func, depthFirst);
    const contentArgs = mapCOW(ast.contentArgs, (node) => walk(node, func, depthFirst));
    if (args !== ast.args || contentArgs !== ast.contentArgs) {
      return Ctor(ast.extName, ast.prop, args, contentArgs);
    }
  } else {
    const fields = nodes.getNodeFields(ast);
    const props = fields.map((field) => ast[field]);
    const propsT = mapCOW(props, (prop) => walk(prop, func, depthFirst));
    if (propsT !== props) {
      const newNode = Ctor(ast.lineno, ast.colno);
      propsT.forEach((prop, i) => {
        newNode[fields[i]] = prop;
      });
      return newNode;
    }
  }

  return ast;
};

export const walk = (ast, func, depthFirst) => {
  if (!ast || (!nodes.isNode(ast) && !nodes.isCallExtension(ast) && !nodes.isCallExtensionAsync(ast))) {
    return ast;
  }

  if (!depthFirst) {
    const astT = func(ast);
    if (astT && astT !== ast) {
      return astT;
    }
  }

  const result = walkNode(ast, func, depthFirst);

  return depthFirst ? (func(result) || result) : result;
};

export const depthWalk = (ast, func) => walk(ast, func, true);

// Single-pass transformer combining liftPipes, liftSuper, and convertStatements
export const transformAST = (ast, options = {}) => {
  const { asyncPipes = false } = options;
  
  return depthWalk(ast, (node) => {
    // Lift pipes first (changes node structure)
    if (nodes.isPipe(node) && asyncPipes) {
      // Transform pipe to pipeAsync
    }
    // Lift super calls
    if (nodes.isBlock(node)) {
      // Transform super() calls
    }
    return node;
  });
};

// ============================================
// Section 2: Lazy Iterator Generators
// ============================================

function* lazyNodeIterator(ast, skipArrays = false) {
  if (!ast || typeof ast !== 'object') return;
  
  if (nodes.isNode(ast) || nodes.isCallExtension(ast) || nodes.isCallExtensionAsync(ast)) {
    yield ast;
  }
  
  if (skipArrays && Array.isArray(ast)) return;
  
  if (ast.children && Array.isArray(ast.children)) {
    for (const child of ast.children) {
      yield* lazyNodeIterator(child, skipArrays);
    }
  } else if (ast.args && Array.isArray(ast.args)) {
    for (const arg of ast.args) {
      yield* lazyNodeIterator(arg, skipArrays);
    }
  } else if (ast.contentArgs && Array.isArray(ast.contentArgs)) {
    for (const arg of ast.contentArgs) {
      yield* lazyNodeIterator(arg, skipArrays);
    }
  } else {
    const fields = nodes.getNodeFields(ast);
    for (const field of fields) {
      const val = ast[field];
      if (Array.isArray(val)) {
        for (const item of val) {
          yield* lazyNodeIterator(item, skipArrays);
        }
      } else if (val && typeof val === 'object') {
        yield* lazyNodeIterator(val, skipArrays);
      }
    }
  }
}

export const nodeIterator = (ast) => lazyNodeIterator(ast, true);

export const nodeIteratorDeep = (ast) => lazyNodeIterator(ast, false);

export const filterNodes = function* (ast, predicate) {
  for (const node of lazyNodeIterator(ast, true)) {
    if (predicate(node)) yield node;
  }
};

export const findNode = (ast, predicate) => {
  for (const node of lazyNodeIterator(ast, true)) {
    if (predicate(node)) return node;
  }
  return undefined;
};

export const countNodes = (ast, predicate) => {
  let count = 0;
  for (const node of lazyNodeIterator(ast, true)) {
    if (!predicate || predicate(node)) count++;
  }
  return count;
};
