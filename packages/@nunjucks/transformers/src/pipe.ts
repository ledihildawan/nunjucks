// PIPE - Transform pipes to async pipes
// Import directly: import { liftPipes } from '@nunjucks/transformers/pipe'

import { T, type Node } from '@nunjucks/nodes/types';
import { literal, symbol, nodeList, pipeAsync, isPipe, isCallExtensionAsync } from '@nunjucks/nodes/factory';
import { isOutput, isSet, isFor, isIf, isBlock } from '@nunjucks/nodes/guards';
import { depthWalk, type walk } from './walk.ts';

const _liftPipes = (node: Node, asyncPipes: string[], prop: string | null, gensym: () => string): Node => {
  let children: Node[] = [];

  const walked = depthWalk(prop ? (node as unknown as Record<string, unknown>)[prop] as Node : node, (descNode: Node) => {
    let newSymbol: Node | undefined;
    if (isBlock(descNode)) {
      return descNode;
    } else if ((isPipe(descNode) && asyncPipes.includes((descNode as unknown as { name: Node }).name.value)) ||
      isCallExtensionAsync(descNode)) {
      newSymbol = symbol(descNode.lineno, descNode.colno, gensym());
      children.push(pipeAsync(
        descNode.lineno,
        descNode.colno,
        (descNode as unknown as { name: Node }).name,
        (descNode as unknown as { args: Node[] }).args,
        newSymbol
      ));
    }
    return newSymbol;
  });

  if (prop) {
    (node as unknown as Record<string, unknown>)[prop] = walked;
  } else {
    node = walked;
  }

  if (children.length) {
    children.push(node);
    return nodeList(node.lineno, node.colno, children);
  }
  return node;
};

export const liftPipes = (ast: Node, asyncPipes: string[]): Node => {
  const gensym = (() => {
    let counter = 0;
    return () => `pipe_${counter++}`;
  })();

  return depthWalk(ast, (node: Node): Node | undefined => {
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
