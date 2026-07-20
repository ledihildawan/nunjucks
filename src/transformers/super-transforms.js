import { nodes } from '../nodes/index.js';
import { walk } from './walk.js';
import { createGensym } from './symbol-generator.js';

export const liftSuper = (ast) => {
  return walk(ast, (blockNode) => {
    if (!nodes.isBlock(blockNode)) {
      return;
    }

    let hasSuper = false;
    let superLocation = null;
    const gensym = createGensym();
    const symbol = gensym();

    blockNode.body = walk(blockNode.body, (node) => {
      if (nodes.isFunCall(node) && node.name.value === 'super') {
        hasSuper = true;
        superLocation = {
          lineno: node.name?.lineno ?? node.lineno,
          colno: node.name?.colno ?? node.colno
        };
        return nodes.symbol(superLocation.lineno, superLocation.colno, symbol);
      }
      return node;
    });

    if (hasSuper) {
      const lineno = superLocation?.lineno ?? blockNode.lineno;
      const colno = superLocation?.colno ?? blockNode.colno;
      blockNode.body.children.unshift(nodes.super(
        lineno,
        colno,
        blockNode.name,
        nodes.symbol(lineno, colno, symbol)
      ));
    }
  });
};
