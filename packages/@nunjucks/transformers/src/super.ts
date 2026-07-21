// SUPER - Transform super() calls in blocks
// Import directly: import { liftSuper } from '@nunjucks/transformers/super'

import { type Node } from '@nunjucks/nodes/types';
import { symbol, super_ } from '@nunjucks/nodes/factory';
import { isBlock, isFunCall } from '@nunjucks/nodes/guards';
import { walk } from './walk.ts';

export const liftSuper = (ast: Node): Node => {
  return walk(ast, (blockNode: Node): Node | undefined => {
    if (!isBlock(blockNode)) return undefined;

    let hasSuper = false;
    let superLocation: { lineno: number; colno: number } | null = null;
    
    let counter = 0;
    const gensym = () => `super_${counter++}`;
    const sym = gensym();

    (blockNode as unknown as { body: Node }).body = walk((blockNode as unknown as { body: Node }).body, (node: Node): Node => {
      if (isFunCall(node) && (node as unknown as { name: Node }).name.value === 'super') {
        hasSuper = true;
        superLocation = {
          lineno: ((node as unknown as { name: Node }).name.lineno) ?? node.lineno,
          colno: ((node as unknown as { name: Node }).name.colno) ?? node.colno
        };
        return symbol(superLocation.lineno, superLocation.colno, sym);
      }
      return node;
    });

    if (hasSuper && superLocation) {
      const lineno = superLocation.lineno;
      const colno = superLocation.colno;
      const bodyChildren = ((blockNode as unknown as { body: Node & { children: Node[] } }).body.children);
      bodyChildren.unshift(super_(
        lineno,
        colno,
        (blockNode as unknown as { name: string }).name,
        symbol(lineno, colno, sym)
      ));
    }

    return blockNode;
  });
};
