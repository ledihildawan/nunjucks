import { createGensym } from '@nunjucks/lib/gensym';
import type { CallNode, Node } from '@nunjucks/nodes';
import { getChildNodes, isBlock, isFunCall, superNode, symbol, walk } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import { flatMap } from 'remeda';

const isSuperCall = (node: Node): boolean =>
  isFunCall(node) && typeof node.name !== 'string' && node.name?.value === 'super';

// WHY: the search must not cross into nested {% block %} bodies — a super() there binds to ITS
// own block, which liftSuper visits separately; lifting it here would misbind it to the outer block.
const findDirectSuperCalls = (node: Node): Node[] => {
  const self = isSuperCall(node) ? [node] : [];
  const descendants = isBlock(node)
    ? []
    : flatMap(getChildNodes(node), findDirectSuperCalls);
  return [...self, ...descendants];
};

export const liftSuper = (ast: Node): Node =>
  walk(ast, (blockNode: Node): Node | undefined => {
    if (!isBlock(blockNode)) {
      return;
    }

    const { body } = blockNode;
    if (!body) {
      return;
    }

    // WHY: isSuperCall guarantees a funCall with a symbol callee, so this cast mirrors the
    // pre-existing sound narrowing without resurrecting the redundant .find(isFunCall).
    const superCall = findDirectSuperCalls(body)[0] as CallNode | undefined;
    if (!superCall) {
      return;
    }

    const nameNode = superCall.name as { value: string; lineno: number; colno: number };
    const superLoc = { lineno: nameNode.lineno, colno: nameNode.colno };
    const gensym = createGensym('hole');
    const sym = gensym();

    const newBody = walk(body, (node: Node): Node | undefined => {
      if (isSuperCall(node)) {
        return symbol(loc(superLoc), sym);
      }
      // WHY: shallow-clone guard so walk does not descend into nested blocks and replace THEIR
      // super() calls with this block's symbol.
      if (node !== body && isBlock(node)) {
        return { ...node };
      }
    });

    const bodyChildren = newBody.children ?? [];
    const blockName =
      typeof blockNode.name === 'string' ? blockNode.name : String(blockNode.name?.value ?? '');
    const newChildren = [
      superNode(loc(superLoc), { blockName, sym: symbol(loc(superLoc), sym) }),
      ...bodyChildren,
    ];
    const replacedBody = { ...newBody, children: newChildren };
    return { ...blockNode, body: replacedBody };
  });
