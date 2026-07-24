
// PIPE - Transform pipes to async pipes
import type { Node } from '@nunjucks/nodes/types';
import { symbol, nodeList, pipeAsync } from '@nunjucks/nodes/factory';
import { isPipe, isCallExtensionAsync, isOutput, isSet, isFor, isIf, isBlock, isSymbol } from '@nunjucks/nodes/guards';
import { depthWalk } from '@nunjucks/nodes/traverse';

const getPipeName = (node: Node): string | null => {
  if (typeof node.name === 'string') {
    return node.name;
  }
  if (isSymbol(node.name) && typeof node.name.value === 'string') {
    return node.name.value;
  }
  return null;
};

const replaceOutput = (outputNode: Node, target: Node): Node => {
  if (isOutput(target)) {
    return target;
  }
  return outputNode;
};

const _liftPipes = <TNode extends Node>(
  node: TNode,
  target: Node,
  asyncPipes: string[],
  replaceTarget: (node: TNode, target: Node) => TNode,
  gensym: () => string,
): Node => {
  const collected: Node[] = [];

  const walked = depthWalk(target, (descNode: Node): Node | undefined => {
    if (isBlock(descNode)) { return descNode; }
    if (isPipe(descNode)) {
      const pipeName = getPipeName(descNode);
      if (!(pipeName && asyncPipes.includes(pipeName))) { return; }
      const newSymbol = symbol(descNode.lineno, descNode.colno, gensym());
      collected.push(
        pipeAsync(
          descNode.lineno,
          descNode.colno,
          descNode.name,
          descNode.args,
          newSymbol,
        ),
      );
      return newSymbol;
    }
    if (isCallExtensionAsync(descNode)) {
      const newSymbol = symbol(descNode.lineno, descNode.colno, gensym());
      collected.push(
        pipeAsync(
          descNode.lineno,
          descNode.colno,
          symbol(descNode.lineno, descNode.colno, descNode.extName),
          descNode.args.children ?? [],
          newSymbol,
        ),
      );
      return newSymbol;
    }
  });

  if (collected.length === 0) {
    return node;
  }

  const newRoot = replaceTarget(node, walked);
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
      return _liftPipes(node, node, asyncPipes, replaceOutput, gensym);
    } if (isSet(node) && node.value) {
      return _liftPipes(node, node.value, asyncPipes, (setNode, value) => ({ ...setNode, value }), gensym);
    } if (isFor(node) && node.arr) {
      return _liftPipes(node, node.arr, asyncPipes, (forNode, arr) => ({ ...forNode, arr }), gensym);
    } if (isIf(node) && node.cond) {
      return _liftPipes(node, node.cond, asyncPipes, (ifNode, cond) => ({ ...ifNode, cond }), gensym);
    } if (isCallExtensionAsync(node)) {
      return _liftPipes(node, node.args, asyncPipes, (callNode, args) => ({ ...callNode, args }), gensym);
    }
  });
};
