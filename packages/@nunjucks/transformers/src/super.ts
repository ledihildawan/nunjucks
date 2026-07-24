
// SUPER - Transform super() calls in blocks
import type { Node } from '@nunjucks/nodes/types';
import { symbol, super_ } from '@nunjucks/nodes/factory';
import { isBlock, isFunCall } from '@nunjucks/nodes/guards';
import { createGensym } from './symbol.ts';
import { walk } from '@nunjucks/nodes/traverse';

export const liftSuper = (ast: Node): Node => walk(ast, (blockNode: Node): Node | undefined => {
    if (!isBlock(blockNode)) { return; }

    const { body } = blockNode as unknown as { body?: Node };
    if (!body) { return; }

    let hasSuper = false;
    let superLocation: { lineno: number; colno: number } | null = null;
    const gensym = createGensym();
    const sym = gensym();

    const newBody = walk(body, (node: Node): Node | undefined => {
      if (isFunCall(node)) {
        const { name } = node as unknown as { name?: { value?: string; lineno?: number; colno?: number } };
        if (name && name.value === 'super') {
          hasSuper = true;
          superLocation = {
            lineno: name.lineno ?? node.lineno,
            colno: name.colno ?? node.colno,
          };
          return symbol(superLocation.lineno, superLocation.colno, sym);
        }
      }
    });

    if (!(hasSuper && superLocation)) { return; }

    const superLoc = superLocation as { lineno: number; colno: number };
    const { children: bodyChildren = [] } = newBody as unknown as { children?: Node[] };
    const { name: blockName } = blockNode as unknown as { name: string };
    const newChildren = [
      super_(
        superLoc.lineno,
        superLoc.colno,
        blockName,
        symbol(superLoc.lineno, superLoc.colno, sym),
      ),
      ...bodyChildren,
    ];
    const replacedBody = { ...newBody, children: newChildren } as Node;
    return { ...blockNode, body: replacedBody } as Node;
  });
