import { isLookupVal, type Node } from '@nunjucks/nodes';
import type { NodeLocation } from '@nunjucks/shared';

// WHY: location-utils validates arbitrary unknown objects (not branded NodeBase
// values), so the runtime integer probe stays — but as a type predicate, so the
// `colno + colnoOffset` arithmetic below operates on narrowed numbers.
const hasIntegerLocation = (node: {
  lineno: unknown;
  colno: unknown;
}): node is { lineno: number; colno: number } =>
  Number.isInteger(node.lineno) && Number.isInteger(node.colno);

/**
 * Extracts a property's location from `node`, preferring a lookup's `val`
 * child (plus `colnoOffset` for bracket quoting) so guards point at the
 * property being accessed.
 */
export const extractPropertyLocation = (
  node: Node | null | undefined,
  colnoOffset = 0
): NodeLocation => {
  if (!node) {
    return { lineno: null, colno: null };
  }
  if (isLookupVal(node)) {
    const value = node.val;
    if (value && hasIntegerLocation(value)) {
      return { lineno: value.lineno, colno: value.colno + colnoOffset };
    }
  }
  return { lineno: node.lineno, colno: node.colno };
};
