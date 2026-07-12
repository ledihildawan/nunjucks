import {
  NodeList,
  PipeAsync,
  AstSymbol,
  isBlock,
  isPipe,
  isCallExtensionAsync,
  isOutput,
  isSet,
  isFor,
  isIf,
} from '../nodes/index.js';
import { depthWalk } from './walk.js';
import { createGensym } from './symbol-generator.js';

const _liftPipes = (node, asyncPipes, prop, gensym) => {
  let children = [];

  let walked = depthWalk(prop ? node[prop] : node, (descNode) => {
    let symbol;
    if (isBlock(descNode)) {
      return descNode;
    } else if ((isPipe(descNode) &&
      asyncPipes.includes(descNode.name.value)) ||
      isCallExtensionAsync(descNode)) {
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
    if (isOutput(node)) {
      return _liftPipes(node, asyncPipes, null, gensym);
    } else if (isSet(node)) {
      return _liftPipes(node, asyncPipes, 'value', gensym);
    } else if (isFor(node)) {
      return _liftPipes(node, asyncPipes, 'arr', gensym);
    } else if (isIf(node)) {
      return _liftPipes(node, asyncPipes, 'cond', gensym);
    } else if (isCallExtensionAsync(node)) {
      return _liftPipes(node, asyncPipes, 'args', gensym);
    }
    return undefined;
  });
};
