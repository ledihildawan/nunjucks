import {
  If,
  For,
  IfAsync,
  AsyncEach,
  AsyncAll,
  PipeAsync,
  CallExtensionAsync,
} from '../nodes.js';
import { walk, depthWalk } from './walk.js';

export const convertStatements = (ast) => {
  return depthWalk(ast, (node) => {
    if (!(node instanceof If) && !(node instanceof For)) {
      return undefined;
    }

    let async = false;
    walk(node, (child) => {
      if (child instanceof PipeAsync ||
        child instanceof IfAsync ||
        child instanceof AsyncEach ||
        child instanceof AsyncAll ||
        child instanceof CallExtensionAsync) {
        async = true;
        return child;
      }
      return undefined;
    });

    if (async) {
      if (node instanceof If) {
        return new IfAsync(
          node.lineno,
          node.colno,
          node.cond,
          node.body,
          node.else_
        );
      } else if (node instanceof For && !(node instanceof AsyncAll)) {
        return new AsyncEach(
          node.lineno,
          node.colno,
          node.arr,
          node.name,
          node.body,
          node.else_
        );
      }
    }
    return undefined;
  });
};
