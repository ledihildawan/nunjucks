import {
  If,
  For,
  IfAsync,
  AsyncEach,
  AsyncAll,
  PipeAsync,
  CallExtensionAsync,
} from '../nodes/index.js';
import { walk, depthWalk } from './walk.js';

export const convertStatements = (ast) => {
  return depthWalk(ast, (node) => {
    if (node.typename !== 'If' && node.typename !== 'For') {
      return undefined;
    }

    let async = false;
    walk(node, (child) => {
      if (child.typename === 'PipeAsync' ||
        child.typename === 'IfAsync' ||
        child.typename === 'AsyncEach' ||
        child.typename === 'AsyncAll' ||
        child.typename === 'CallExtensionAsync') {
        async = true;
        return child;
      }
      return undefined;
    });

    if (async) {
      if (node.typename === 'If') {
        return IfAsync(
          node.lineno,
          node.colno,
          node.cond,
          node.body,
          node.else_
        );
      } else if (node.typename === 'For' && node.typename !== 'AsyncAll') {
        return AsyncEach(
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
