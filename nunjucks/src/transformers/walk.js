import * as nodeTypes from '../nodes.js';
import {
  Node,
  NodeList,
  CallExtension,
} from '../nodes.js';

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

  if (ast instanceof NodeList) {
    const children = mapCOW(ast.children, (node) => walk(node, func, depthFirst));
    if (children !== ast.children) {
      ast = new nodeTypes[ast.typename](ast.lineno, ast.colno, children);
    }
  } else if (ast instanceof CallExtension) {
    const args = walk(ast.args, func, depthFirst);
    const contentArgs = mapCOW(ast.contentArgs, (node) => walk(node, func, depthFirst));
    if (args !== ast.args || contentArgs !== ast.contentArgs) {
      ast = new nodeTypes[ast.typename](ast.extName, ast.prop, args, contentArgs);
    }
  } else {
    const props = ast.fields.map((field) => ast[field]);
    const propsT = mapCOW(props, (prop) => walk(prop, func, depthFirst));
    if (propsT !== props) {
      ast = new nodeTypes[ast.typename](ast.lineno, ast.colno);
      propsT.forEach((prop, i) => {
        ast[ast.fields[i]] = prop;
      });
    }
  }

  return depthFirst ? (func(ast) || ast) : ast;
};

export const depthWalk = (ast, func) => walk(ast, func, true);
