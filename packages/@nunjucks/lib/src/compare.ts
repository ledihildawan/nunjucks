import { isString } from 'remeda';
import { getAttrGetter } from './attribute-getter.ts';

const toComparable = (value: unknown): string | number => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return String(value);
};

interface ComparisonInput {
  left: unknown;
  right: unknown;
  caseSens: boolean | undefined;
  sortReverse: boolean | undefined;
}

/**
 * Compares two `unknown` values for sorting: strings and numbers compare in
 * their natural domain, everything else is coerced to its string form. When
 * both sides are strings and `caseSens` is falsy the comparison lowercases
 * them; `sortReverse` flips the returned `-1`/`0`/`1` sign.
 */
const compareValues = ({ left, right, caseSens, sortReverse }: ComparisonInput): number => {
  const leftRaw = toComparable(left);
  const rightRaw = toComparable(right);
  const lower = !caseSens && isString(leftRaw) && isString(rightRaw);
  const leftValue = lower ? leftRaw.toLowerCase() : leftRaw;
  const rightValue = lower ? rightRaw.toLowerCase() : rightRaw;
  if (leftValue < rightValue) {
    return sortReverse ? 1 : -1;
  }
  if (leftValue > rightValue) {
    return sortReverse ? -1 : 1;
  }
  return 0;
};

const getCompareValue = (item: unknown, sortAttr: string | undefined): unknown => {
  if (!sortAttr) {
    return item;
  }
  return getAttrGetter(sortAttr)(item);
};

interface SortComparatorOptions {
  sortAttr?: string | undefined;
  sortReverse?: boolean | undefined;
  caseSens?: boolean | undefined;
}

/**
 * Builds an `Array#sort` comparator from sort options. When `sortAttr` is
 * set, items are first projected through the dotted-path attribute getter —
 * a missing attribute compares as the string `"undefined"`.
 */
const createSortComparator = ({ sortAttr, sortReverse, caseSens }: SortComparatorOptions) => {
  return (a: unknown, b: unknown): number => {
    const left = getCompareValue(a, sortAttr);
    const right = getCompareValue(b, sortAttr);
    return compareValues({ left, right, caseSens, sortReverse });
  };
};

export { compareValues, createSortComparator };
// WHY: compareValues stays module-exported for the internal createSortComparator path and
// its unit tests, but is deliberately NOT re-exported from the package barrel — it is an
// implementation detail of sorting, not a public @nunjucks/lib name.
