import { isString } from 'remeda';
import { getAttrGetter } from './deep-get.ts';

const toComparable = (value: unknown): string | number => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return String(value);
};

interface ComparisonInput {
  left: unknown;
  right: unknown;
  caseSens: boolean | string | undefined;
  sortReverse: boolean | string | undefined;
}

const compareValues = ({ left, right, caseSens, sortReverse }: ComparisonInput): number => {
  const leftRaw = toComparable(left);
  const rightRaw = toComparable(right);
  const lower = !caseSens && isString(leftRaw) && isString(rightRaw);
  const leftValue = lower ? leftRaw.toLowerCase() : leftRaw;
  const rightValue = lower ? rightRaw.toLowerCase() : rightRaw;
  if (leftValue < rightValue) { return sortReverse ? 1 : -1; }
  if (leftValue > rightValue) { return sortReverse ? -1 : 1; }
  return 0;
};

const getCompareValue = (item: unknown, sortAttr: string | undefined): unknown => {
  if (!sortAttr) { return item; }
  return getAttrGetter(sortAttr)(item as Record<string, unknown>);
};

interface SortComparatorOptions {
  sortAttr?: string | undefined;
  sortReverse?: boolean | string | undefined;
  caseSens?: boolean | string | undefined;
}

const createSortComparator = ({ sortAttr, sortReverse, caseSens }: SortComparatorOptions) => {
  return (a: unknown, b: unknown): number => {
    const left = getCompareValue(a, sortAttr);
    const right = getCompareValue(b, sortAttr);
    return compareValues({ left, right, caseSens, sortReverse });
  };
};

export { toComparable, compareValues, createSortComparator };