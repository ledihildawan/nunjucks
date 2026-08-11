import type { Node } from '@nunjucks/nodes';
import { symbol, superNode, isBlock, isFunCall, walk, findAll } from '@nunjucks/nodes';
import { createGensym } from '@nunjucks/lib/gensym';
import { loc } from '@nunjucks/shared';

export const liftSuper = (ast: Node): Node => walk(ast, (blockNode: Node): Node | undefined => {
    if (!isBlock(blockNode)) { return; }

    const { body } = blockNode;
    if (!body) { return; }

    const isSuperCall = (node: Node): boolean =>
      isFunCall(node) && typeof node.name !== 'string' && node.name?.value === 'super';

    const superCall = findAll(body, isSuperCall).find(isFunCall);
    if (!superCall) { return; }

    const nameNode = superCall.name as { value: string; lineno: number; colno: number };
    const superLoc = { lineno: nameNode.lineno, colno: nameNode.colno };
    const gensym = createGensym('hole');
    const sym = gensym();

    const newBody = walk(body, (node: Node): Node | undefined => {
      if (isSuperCall(node)) {
        return symbol(loc(superLoc), sym);
      }
    });

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
