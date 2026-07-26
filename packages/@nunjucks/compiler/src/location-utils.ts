import { isLookupVal, type Node } from '@nunjucks/nodes';

/**
 * For a node, return the location of its "property name" — i.e., for
 * a LookupVal like `a.b.c`, return the location of `c` rather than `a`.
 *
 * Falls back to the LookupVal's own location when its property lacks one.
 *
 * Use the optional `colnoOffset` parameter to shift the column (e.g.,
 * to skip a leading `[` in a bracket-string access like `obj['foo']`).
 */
export interface NodeLocation {
  lineno: number | null;
  colno: number | null;
}

export const extractPropertyLocation = (
  node: Node | null | undefined,
  colnoOffset = 0
): NodeLocation => {
  if (!node) { return { lineno: null, colno: null }; }
  if (isLookupVal(node)) {
    const val = node.val as Node | undefined;
    if (val && val.lineno !== null && val.lineno !== undefined &&
        val.colno !== null && val.colno !== undefined) {
      return { lineno: val.lineno, colno: val.colno + colnoOffset };
    }
    return { lineno: node.lineno ?? null, colno: node.colno ?? null };
  }
  return { lineno: node.lineno ?? null, colno: node.colno ?? null };
};