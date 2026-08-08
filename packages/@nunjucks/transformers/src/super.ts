import type { Node, NodeLocation } from '@nunjucks/nodes';
import { symbol, superNode, isBlock, isFunCall, walk } from '@nunjucks/nodes';
import { createGensym } from '@nunjucks/runtime';
import { loc } from '@nunjucks/shared';

export const liftSuper = (ast: Node): Node => walk(ast, (blockNode: Node): Node | undefined => {
    if (!isBlock(blockNode)) { return; }

    const { body } = blockNode;
    if (!body) { return; }

    const holder: { location: NodeLocation | null } = { location: null };
    const gensym = createGensym();
    const sym = gensym();

    const newBody = walk(body, (node: Node): Node | undefined => {
      if (isFunCall(node)) {
        const { name } = node;
        if (typeof name !== 'string' && name?.value === 'super') {
          const superLoc = { lineno: name.lineno, colno: name.colno };
          holder.location = superLoc;
          return symbol(loc(superLoc), sym);
        }
      }
    });

    const superLoc = holder.location;
    if (superLoc === null) { return; }
    const bodyChildren = newBody.children ?? [];
    const blockName = typeof blockNode.name === 'string' ? blockNode.name : String(blockNode.name?.value ?? '');
    const newChildren = [
      superNode(
        loc(superLoc),
        { blockName, sym: symbol(loc(superLoc), sym) },
      ),
      ...bodyChildren,
    ];
    const replacedBody = { ...newBody, children: newChildren };
    return { ...blockNode, body: replacedBody };
  });
