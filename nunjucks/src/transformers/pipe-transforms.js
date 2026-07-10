import {
  NodeList,
  Block,
  Pipe,
  PipeAsync,
  CallExtensionAsync,
  AstSymbol,
  For,
  If,
  Set,
  Output,
} from '../nodes/index.js';
import { depthWalk } from './walk.js';
import { createGensym } from './symbol-generator.js';

const _liftPipes = (node, asyncPipes, prop, gensym) => {
  let children = [];

  let walked = depthWalk(prop ? node[prop] : node, (descNode) => {
    let symbol;
    if (descNode.typename === 'Block') {
      return descNode;
    } else if ((descNode.typename === 'Pipe' &&
      asyncPipes.indexOf(descNode.name.value) !== -1) ||
      descNode.typename === 'CallExtensionAsync') {
      symbol = AstSymbol(
        descNode.lineno,
        descNode.colno,
        gensym()
      );
      children.push(PipeAsync(
        descNode.lineno,
        descNode.colno,
        descNode.name,
        descNode.args,
        symbol
      ));
    }
    return symbol;
  });

  if (prop) {
    node[prop] = walked;
  } else {
    node = walked;
  }

  if (children.length) {
    children.push(node);
    return NodeList(node.lineno, node.colno, children);
  }
  return node;
};

export const liftPipes = (ast, asyncPipes) => {
  const gensym = createGensym();
  return depthWalk(ast, (node) => {
    if (node.typename === 'Output') {
      return _liftPipes(node, asyncPipes, null, gensym);
    } else if (node.typename === 'Set') {
      return _liftPipes(node, asyncPipes, 'value', gensym);
    } else if (node.typename === 'For') {
      return _liftPipes(node, asyncPipes, 'arr', gensym);
    } else if (node.typename === 'If') {
      return _liftPipes(node, asyncPipes, 'cond', gensym);
    } else if (node.typename === 'CallExtensionAsync') {
      return _liftPipes(node, asyncPipes, 'args', gensym);
    }
    return undefined;
  });
};
