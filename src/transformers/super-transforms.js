import {
  Block,
  FunCall,
  AstSymbol,
  Super,
  isBlock,
  isFunCall,
} from '../nodes/index.js';
import { walk } from './walk.js';
import { createGensym } from './symbol-generator.js';

export const liftSuper = (ast) => {
  return walk(ast, (blockNode) => {
    if (!isBlock(blockNode)) {
      return;
    }

    let hasSuper = false;
    const gensym = createGensym();
    const symbol = gensym();

    blockNode.body = walk(blockNode.body, (node) => {
      if (isFunCall(node) && node.name.value === 'super') {
        hasSuper = true;
        return AstSymbol(node.lineno, node.colno, symbol);
      }
      return node;
    });

    if (hasSuper) {
      blockNode.body.children.unshift(Super(
        0, 0, blockNode.name, AstSymbol(0, 0, symbol)
      ));
    }
  });
};
