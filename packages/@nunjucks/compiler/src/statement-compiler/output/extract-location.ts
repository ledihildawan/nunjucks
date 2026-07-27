import { isLookupVal, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { extractPropertyLocation } from '../../location-utils.ts';

export const extractVarName = (node: Node): string | null => {
  if (isSymbol(node)) {
    return node.value as string;
  }

  if (isLookupVal(node)) {
    const base = extractVarName(node.target as Node);
    if (!base) {
      return null;
    }
    const value = node.val as Node;
    const property = (value?.value as unknown) || (value?.name as unknown) || '';
    return `${base}.${property}`;
  }

  return null;
};

export const extractLocation = (
  node: Node
): { lineno: number | null; colno: number | null } =>
  extractPropertyLocation(node);
