import {
  NodeList,
  Block,
  Pipe,
  PipeAsync,
  CallExtensionAsync,
  AstSymbol,
  For,
  If,
  Set as AstSet,
  Output,
} from '../nodes.js';
import { depthWalk } from './walk.js';
import { createGensym } from './symbol-generator.js';

const _liftPipes = (node, asyncPipes, prop, gensym) => {
  let children = [];

  let walked = depthWalk(prop ? node[prop] : node, (descNode) => {
    let symbol;
    if (descNode instanceof Block) {
      return descNode;
    } else if ((descNode instanceof Pipe &&
      asyncPipes.indexOf(descNode.name.value) !== -1) ||
      descNode instanceof CallExtensionAsync) {
      symbol = new AstSymbol(
        descNode.lineno,
        descNode.colno,
        gensym()
      );
      children.push(new PipeAsync(
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
    return new NodeList(node.lineno, node.colno, children);
  }
  return node;
};

export const liftPipes = (ast, asyncPipes) => {
  const gensym = createGensym();
  return depthWalk(ast, (node) => {
    if (node instanceof Output) {
      return _liftPipes(node, asyncPipes, null, gensym);
    } else if (node instanceof AstSet) {
      return _liftPipes(node, asyncPipes, 'value', gensym);
    } else if (node instanceof For) {
      return _liftPipes(node, asyncPipes, 'arr', gensym);
    } else if (node instanceof If) {
      return _liftPipes(node, asyncPipes, 'cond', gensym);
    } else if (node instanceof CallExtensionAsync) {
      return _liftPipes(node, asyncPipes, 'args', gensym);
    }
    return undefined;
  });
};
