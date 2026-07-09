import {
  Block,
  FunCall,
  Symbol as ASTSymbol,
  Super,
} from '../nodes.js';
import { walk } from './walk.js';
import { createGensym } from './symbol-generator.js';

export const liftSuper = (ast) => {
  return walk(ast, (blockNode) => {
    if (!(blockNode instanceof Block)) {
      return;
    }

    let hasSuper = false;
    const gensym = createGensym();
    const symbol = gensym();

    blockNode.body = walk(blockNode.body, (node) => {
      if (node instanceof FunCall && node.name.value === 'super') {
        hasSuper = true;
        return new ASTSymbol(node.lineno, node.colno, symbol);
      }
      return node;
    });

    if (hasSuper) {
      blockNode.body.children.unshift(new Super(
        0, 0, blockNode.name, new ASTSymbol(0, 0, symbol)
      ));
    }
  });
};
