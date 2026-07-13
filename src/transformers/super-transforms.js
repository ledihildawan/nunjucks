import { nodes } from '../nodes/index.js';
import { walk } from './walk.js';
import { createGensym } from './symbol-generator.js';

export const liftSuper = (ast) => {
  return walk(ast, (blockNode) => {
    if (!nodes.isBlock(blockNode)) {
      return;
    }

    let hasSuper = false;
    const gensym = createGensym();
    const symbol = gensym();

    blockNode.body = walk(blockNode.body, (node) => {
      if (nodes.isFunCall(node) && node.name.value === 'super') {
        hasSuper = true;
        return nodes.symbol(node.lineno, node.colno, symbol);
      }
      return node;
    });

    if (hasSuper) {
      blockNode.body.children.unshift(nodes.super(
        0, 0, blockNode.name, nodes.symbol(0, 0, symbol)
      ));
    }
  });
};
