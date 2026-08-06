import type { Node, NodeLocation } from '@nunjucks/nodes';
import { symbol, super_, isBlock, isFunCall, walk } from '@nunjucks/nodes';
import { createGensym } from '@nunjucks/runtime';

export const liftSuper = (ast: Node): Node => walk(ast, (blockNode: Node): Node | undefined => {
    if (!isBlock(blockNode)) { return; }

    const { body } = blockNode;
    if (!body) { return; }

    let hasSuper = false;
    let superLocation: NodeLocation | null = null;
    const gensym = createGensym();
    const sym = gensym();

    const newBody = walk(body, (node: Node): Node | undefined => {
      if (isFunCall(node)) {
        const { name } = node;
        if (typeof name !== 'string' && name?.value === 'super') {
          hasSuper = true;
          superLocation = {
            lineno: name.lineno,
            colno: name.colno,
          };
          return symbol(superLocation.lineno, superLocation.colno, sym);
        }
      }
    });

    if (!(hasSuper && superLocation)) { return; }

    const superLoc = superLocation as NodeLocation;
    const bodyChildren = newBody.children ?? [];
    const blockName = typeof blockNode.name === 'string' ? blockNode.name : String(blockNode.name?.value ?? '');
    const newChildren = [
      super_(
        superLoc.lineno,
        superLoc.colno,
        blockName,
        symbol(superLoc.lineno, superLoc.colno, sym),
      ),
      ...bodyChildren,
    ];
    const replacedBody = { ...newBody, children: newChildren };
    return { ...blockNode, body: replacedBody };
  });
