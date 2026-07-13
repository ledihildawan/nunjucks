import { nodes } from '../nodes/index.js';
import { depthWalk } from './walk.js';
import { createGensym } from './symbol-generator.js';

const _liftPipes = (node, asyncPipes, prop, gensym) => {
  let children = [];

  let walked = depthWalk(prop ? node[prop] : node, (descNode) => {
    let symbol;
    if (nodes.isBlock(descNode)) {
      return descNode;
    } else if ((nodes.isPipe(descNode) &&
      asyncPipes.includes(descNode.name.value)) ||
      nodes.isCallExtensionAsync(descNode)) {
      symbol = nodes.symbol(
        descNode.lineno,
        descNode.colno,
        gensym()
      );
      children.push(nodes.pipeAsync(
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
    return nodes.nodeList(node.lineno, node.colno, children);
  }
  return node;
};

export const liftPipes = (ast, asyncPipes) => {
  const gensym = createGensym();
  return depthWalk(ast, (node) => {
    if (nodes.isOutput(node)) {
      return _liftPipes(node, asyncPipes, null, gensym);
    } else if (nodes.isSet(node)) {
      return _liftPipes(node, asyncPipes, 'value', gensym);
    } else if (nodes.isFor(node)) {
      return _liftPipes(node, asyncPipes, 'arr', gensym);
    } else if (nodes.isIf(node)) {
      return _liftPipes(node, asyncPipes, 'cond', gensym);
    } else if (nodes.isCallExtensionAsync(node)) {
      return _liftPipes(node, asyncPipes, 'args', gensym);
    }
    return undefined;
  });
};
