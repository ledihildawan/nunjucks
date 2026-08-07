import { isLookupVal, type Node } from '@nunjucks/nodes';
import type { NodeLocation } from '@nunjucks/shared';

export type { NodeLocation };

const hasIntegerLocation = (node: { lineno: unknown; colno: unknown }): boolean =>
  Number.isInteger(node.lineno) && Number.isInteger(node.colno);

export const extractPropertyLocation = (
  node: Node | null | undefined,
  colnoOffset = 0
): NodeLocation => {
  if (!node) { return { lineno: null, colno: null }; }
  if (isLookupVal(node)) {
    const value = node.val;
    if (value && hasIntegerLocation(value)) {
      return { lineno: value.lineno, colno: value.colno + colnoOffset };
    }
  }
  return { lineno: node.lineno, colno: node.colno };
};