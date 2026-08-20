import { createGensym } from '@nunjucks/lib';
import type { CallNode, Node } from '@nunjucks/nodes';
import { getChildNodes, isBlock, isFunCall, superNode, symbol, walk } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import { flatMap } from 'remeda';

const isSuperCall = (node: Node): node is CallNode =>
  isFunCall(node) && typeof node.name !== 'string' && node.name?.value === 'super';

// WHY: the search must not cross into nested {% block %} bodies — a super() there binds to ITS
// own block, which liftSuper visits separately; lifting it here would misbind it to the outer block.
const findDirectSuperCalls = (node: Node): CallNode[] => {
  const self = isSuperCall(node) ? [node] : [];
  const descendants = isBlock(node) ? [] : flatMap(getChildNodes(node), findDirectSuperCalls);
  return [...self, ...descendants];
};

/**
 * Hoists each block's direct `super()` calls into a prepended `superNode` bound to a
 * fresh gensym'd symbol, rewriting the call sites to reference it. Nested blocks bind
 * their own `super`, so a block's body rewrite never crosses into them — instead the
 * walk resumes inside the rewritten block so each nested block is lifted in the same
 * pass. The pass runs between parse and compile, returns a rewritten tree of the same
 * shape, and is idempotent: lifted supers become `super` nodes, leaving no funCalls.
 */
export const liftSuper = (ast: Node): Node => {
  // WHY: one gensym per pass — instantiating inside the visitor reset the counter for every
  // block, so each lifted symbol was identically 'hole_0'. Block scoping made that safe, but
  // unique names keep the generated code debuggable and robust to future scope flattening.
  const gensym = createGensym('hole');
  const visit = (blockNode: Node): Node | undefined => {
    if (!isBlock(blockNode)) {
      return;
    }

    const { body } = blockNode;
    if (!body) {
      return;
    }

    const superCall = findDirectSuperCalls(body)[0];
    if (!superCall) {
      return;
    }

    const superLoc = { lineno: superCall.name.lineno, colno: superCall.name.colno };
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
    const replacedBlock = { ...blockNode, body: { ...newBody, children: newChildren } };
    // WHY: walk short-circuits a replaced subtree — explicitly resume the walk inside the
    // replacement (skipping its root, which is already lifted) so nested blocks calling
    // super() are lifted too instead of failing at render time.
    return walk(replacedBlock, (descendant: Node): Node | undefined =>
      descendant === replacedBlock ? undefined : visit(descendant)
    );
  };
  return walk(ast, visit);
};
