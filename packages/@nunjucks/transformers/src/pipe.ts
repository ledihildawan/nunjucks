// PIPE - Transform pipes to async pipes
// Import directly: import { liftPipes } from '@nunjucks/transformers/pipe'

import { type Node } from '@nunjucks/nodes/types';
import { symbol, nodeList, pipeAsync } from '@nunjucks/nodes/factory';
import { isPipe, isCallExtensionAsync, isOutput, isSet, isFor, isIf, isBlock } from '@nunjucks/nodes/guards';
import { depthWalk } from './walk.ts';

const _liftPipes = (node: Node, asyncPipes: string[], prop: string | null, gensym: () => string): Node => {
  const collected: Node[] = [];
  const target = (prop ? (node as unknown as Record<string, unknown>)[prop] : node) as Node;

  const walked = depthWalk(target, (descNode: Node): Node | undefined => {
    if (isBlock(descNode)) return descNode;
    const name = (descNode as unknown as { name?: { value?: string } }).name;
    if ((isPipe(descNode) && name && asyncPipes.includes(name.value ?? '')) || isCallExtensionAsync(descNode)) {
      const newSymbol = symbol(descNode.lineno, descNode.colno, gensym());
      collected.push(
        pipeAsync(
          descNode.lineno,
          descNode.colno,
          name as Node,
          (descNode as unknown as { args: Node }).args,
          newSymbol,
        ),
      );
      return newSymbol;
    }
    return undefined;
  });

  if (collected.length === 0) {
    return node;
  }

  const newRoot = prop ? ({ ...node, [prop]: walked } as Node) : walked;
  return nodeList(newRoot.lineno, newRoot.colno, [...collected, newRoot]);
};

export const liftPipes = (ast: Node, asyncPipes: string[]): Node => {
  let counter = 0;
  const gensym = () => `pipe_${counter++}`;

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
