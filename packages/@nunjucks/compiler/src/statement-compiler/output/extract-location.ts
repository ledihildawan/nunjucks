import { isLookupVal, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';

export const extractVarName = (node: Node): string | null => {
  if (isSymbol(node)) {
    return node.value;
  }

  if (isLookupVal(node)) {
    const base = extractVarName(node.target);
    if (!base) {
      return null;
    }
    const value = node.val;
    const property = value?.value || String((value as { name?: unknown })?.name ?? '') || '';
    return `${base}.${property}`;
  }

  return null;
};
