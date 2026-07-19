import { nodes } from '../nodes/index.js';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';

const CONSTRUCTOR_MAP = {
  node: nodes.node,
  value: nodes.value,
  nodeList: nodes.nodeList,
  root: nodes.root,
  literal: nodes.literal,
  symbol: nodes.symbol,
  group: nodes.group,
  array: nodes.array,
  pair: nodes.pair,
  dict: nodes.dict,
  lookupVal: nodes.lookupVal,
  optionalChain: nodes.optionalChain,
  optionalCall: nodes.optionalCall,
  slice: nodes.slice,
  if: nodes.if,
  inlineIf: nodes.inlineIf,
  for: nodes.for,
  macro: nodes.macro,
  caller: nodes.caller,
  call: nodes.call,
  import: nodes.import,
  fromImport: nodes.fromImport,
  funCall: nodes.funCall,
  pipe: nodes.pipe,
  pipeAsync: nodes.pipeAsync,
  filter: nodes.pipe,
  keywordArgs: nodes.keywordArgs,
  block: nodes.block,
  super: nodes.super,
  templateRef: nodes.templateRef,
  extends: nodes.extends,
  include: nodes.include,
  set: nodes.set,
  switch: nodes.switch,
  case: nodes.case,
  output: nodes.output,
  capture: nodes.capture,
  tryCatch: nodes.tryCatch,
  do: nodes.do,
  with: nodes.with,
  templateData: nodes.templateData,
  in: nodes.in,
  is: nodes.is,
  or: nodes.or,
  and: nodes.and,
  nullishCoalesce: nodes.nullishCoalesce,
  not: nodes.not,
  add: nodes.add,
  concat: nodes.concat,
  sub: nodes.sub,
  mul: nodes.mul,
  div: nodes.div,
  floorDiv: nodes.floorDiv,
  mod: nodes.mod,
  pow: nodes.pow,
  neg: nodes.neg,
  pos: nodes.pos,
  compare: nodes.compare,
  compareOperand: nodes.compareOperand,
  callExtension: nodes.callExtension,
  callExtensionAsync: nodes.callExtensionAsync,
  spread: nodes.spread,
  walrus: nodes.walrus,
};

export const mapCOW = (arr, func) => {
  let res = null;
  for (let i = 0; i < arr.length; i++) {
    const item = func(arr[i]);

    if (item !== arr[i]) {
      if (!res) {
        res = [...arr];
      }
      res[i] = item;
    }
  }
  return res || arr;
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

  const typeName = nodes.getNodeTypeName(ast);
  const Ctor = CONSTRUCTOR_MAP[typeName];
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
      ast = Ctor(ast.lineno, ast.colno, children);
    }
  } else if (nodes.isCallExtension(ast) || nodes.isCallExtensionAsync(ast)) {
    const args = walk(ast.args, func, depthFirst);
    const contentArgs = mapCOW(ast.contentArgs, (node) => walk(node, func, depthFirst));
    if (args !== ast.args || contentArgs !== ast.contentArgs) {
      ast = Ctor(ast.extName, ast.prop, args, contentArgs);
    }
  } else {
    const fields = nodes.getNodeFields(ast);
    const props = fields.map((field) => ast[field]);
    const propsT = mapCOW(props, (prop) => walk(prop, func, depthFirst));
    if (propsT !== props) {
      ast = Ctor(ast.lineno, ast.colno);
      propsT.forEach((prop, i) => {
        ast[fields[i]] = prop;
      });
    }
  }

  return depthFirst ? (func(ast) || ast) : ast;
};

export const depthWalk = (ast, func) => walk(ast, func, true);
