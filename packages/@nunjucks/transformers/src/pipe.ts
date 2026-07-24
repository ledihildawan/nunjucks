
// PIPE - Transform pipes to async pipes
import type { Node } from '@nunjucks/nodes/types';
import { symbol, nodeList, pipeAsync } from '@nunjucks/nodes/factory';
import { isPipe, isCallExtensionAsync, isOutput, isSet, isFor, isIf, isBlock } from '@nunjucks/nodes/guards';
import { depthWalk } from '@nunjucks/nodes/traverse';

const _liftPipes = (node: Node, asyncPipes: string[], prop: string | null, gensym: () => string): Node => {
  const collected: Node[] = [];
  let target: Node;
  if (prop) {
    target = (node as unknown as Record<string, unknown>)[prop] as Node;
  } else {
    target = node;
  }

  const walked = depthWalk(target, (descNode: Node): Node | undefined => {
    if (isBlock(descNode)) { return descNode; }
    const { name } = descNode as unknown as { name?: { value?: string } };
    if ((isPipe(descNode) && name && asyncPipes.includes(name.value ?? '')) || isCallExtensionAsync(descNode)) {
      const newSymbol = symbol(descNode.lineno, descNode.colno, gensym());
      const { args } = descNode as unknown as { args: Node[] };
      collected.push(
        pipeAsync(
          descNode.lineno,
          descNode.colno,
          name as Node,
          args,
          newSymbol,
        ),
      );
      return newSymbol;
    }
  });

  if (collected.length === 0) {
    return node;
  }

  let newRoot: Node;
  if (prop) {
    newRoot = { ...node, [prop]: walked } as Node;
  } else {
    newRoot = walked;
  }
  return nodeList(newRoot.lineno, newRoot.colno, [...collected, newRoot]);
};

export const liftPipes = (ast: Node, asyncPipes: string[]): Node => {
  let counter = 0;
  const gensym = (): string => {
    const result = `pipe_${counter}`;
    counter += 1;
    return result;
  };

  return depthWalk(ast, (node: Node): Node | undefined => {
    if (isOutput(node)) {
      return _liftPipes(node, asyncPipes, null, gensym);
    } if (isSet(node)) {
      return _liftPipes(node, asyncPipes, 'value', gensym);
    } if (isFor(node)) {
      return _liftPipes(node, asyncPipes, 'arr', gensym);
    } if (isIf(node)) {
      return _liftPipes(node, asyncPipes, 'cond', gensym);
    } if (isCallExtensionAsync(node)) {
      return _liftPipes(node, asyncPipes, 'args', gensym);
    }
  });
};
