import type { Node } from '@nunjucks/nodes';
import { isLookupVal, isSymbol } from '@nunjucks/nodes';

/** Builds the dotted `a.b.c` path from a symbol/lookup chain, or `null`. */
export const extractVarName = (node: Node): string | null => {
  if (isSymbol(node)) {
    return node.value;
  }

  if (isLookupVal(node)) {
    const targetName = extractVarName(node.target);
    if (!targetName) {
      return null;
    }
    const value = node.val;
    const property = value?.value ?? String((value as { name?: unknown })?.name ?? '') ?? '';
    return `${targetName}.${property}`;
  }

  return null;
};
