// SUPER - Transform super() calls in blocks
import { type Node } from '@nunjucks/nodes/types';
import { symbol, super_ } from '@nunjucks/nodes/factory';
import { isBlock, isFunCall } from '@nunjucks/nodes/guards';
import { createGensym } from './symbol.ts';
import { walk } from '@nunjucks/nodes/traverse';

export const liftSuper = (ast: Node): Node => {
  return walk(ast, (blockNode: Node): Node | undefined => {
    if (!isBlock(blockNode)) return undefined;

    const body = (blockNode as unknown as { body?: Node }).body;
    if (!body) return undefined;

    let hasSuper = false;
    let superLocation: { lineno: number; colno: number } | null = null;
    const gensym = createGensym();
    const sym = gensym();

    const newBody = walk(body, (node: Node): Node | undefined => {
      if (isFunCall(node)) {
        const name = (node as unknown as { name?: { value?: string; lineno?: number; colno?: number } }).name;
        if (name && name.value === 'super') {
          hasSuper = true;
          superLocation = {
            lineno: name.lineno ?? node.lineno,
            colno: name.colno ?? node.colno,
          };
          return symbol(superLocation.lineno, superLocation.colno, sym);
        }
      }
      return undefined;
    });

    if (!hasSuper || !superLocation) return undefined;

    const superLoc = superLocation as { lineno: number; colno: number };
    const bodyChildren = (newBody as unknown as { children?: Node[] }).children ?? [];
    const newChildren = [
      super_(
        superLoc.lineno,
        superLoc.colno,
        (blockNode as unknown as { name: string }).name,
        symbol(superLoc.lineno, superLoc.colno, sym),
      ),
      ...bodyChildren,
    ];
    const replacedBody = { ...newBody, children: newChildren } as Node;
    return { ...blockNode, body: replacedBody } as Node;
  });
};
