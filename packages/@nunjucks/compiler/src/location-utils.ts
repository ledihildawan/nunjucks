import { isLookupVal, type Node } from '@nunjucks/nodes';
import type { NodeLocation } from '@nunjucks/shared';

export type { NodeLocation };

/**
 * For a node, return the location of its "property name" — i.e., for
 * a LookupVal like `a.b.c`, return the location of `c` rather than `a`.
 *
 * Falls back to the LookupVal's own location when its property lacks one.
 *
 * Use the optional `colnoOffset` parameter to shift the column (e.g.,
 * to skip a leading `[` in a bracket-string access like `obj['foo']`).
 */
export const extractPropertyLocation = (
  node: Node | null | undefined,
  colnoOffset = 0
): NodeLocation => {
  if (!node) { return { lineno: null, colno: null }; }
  if (isLookupVal(node)) {
    // `Node` types lineno/colno as required numbers, but this value comes off a
    // dynamic AST field, so verify rather than trust -- otherwise a missing
    // colno would silently produce NaN once the offset is added.
    const val = node.val;
    if (val && Number.isInteger(val.lineno) && Number.isInteger(val.colno)) {
      return { lineno: val.lineno, colno: val.colno + colnoOffset };
    }
  }
  return { lineno: node.lineno, colno: node.colno };
};