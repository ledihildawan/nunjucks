import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { isPlainObject, isString, keys, map, pipe, range, reduce, sum as sumValues } from 'remeda';
import { isSafeString, makeComponent } from '@nunjucks/runtime';
import { makeFilterError, isArray, requireArrayError, assertItemsHaveAttr } from '../factory/index.ts';
import { getAttrGetter } from './attributes.ts';

export const first = (arr: unknown): unknown => {
  if (!isArray(arr)) { throw requireArrayError(arr, ERROR_DEFINITIONS.FIRST_LAST_FILTER); }
  return arr[0];
};

export const last = (arr: unknown): unknown => {
  if (!isArray(arr)) { throw requireArrayError(arr, ERROR_DEFINITIONS.FIRST_LAST_FILTER); }
  return arr.at(-1);
};

const isMapOrSet = (value: unknown): boolean =>
  typeof Map === 'function' && (value instanceof Map || value instanceof Set);

const getCollectionSize = (value: unknown): number =>
  (value as Map<unknown, unknown> | Set<unknown>).size;

const getObjectLength = (value: unknown): number =>
  keys(value as Record<string, unknown>).length;

const getValueLength = (value: unknown): number =>
  (value as { length: number }).length;

const getLengthFromValue = (value: unknown): number => {
  if (isMapOrSet(value)) {
    return getCollectionSize(value);
  }
  if (isPlainObject(value) && !isSafeString(value)) {
    return getObjectLength(value);
  }
  return getValueLength(value);
};

export const lengthFilter = (val: unknown): number => {
  const value = val === null || val === undefined || val === false ? '' : val;
  return getLengthFromValue(value);
};

export const reverse = (value: unknown): unknown[] | string => {
  if (typeof value === 'string') {
    return value.split('').toReversed().join('');
  }
  if (isArray(value)) {
    return [...value].toReversed();
  }
  throw makeFilterError(ERROR_DEFINITIONS.LIST_FILTER, { type: typeof value }, typeof value, `Expected string or array but got ${typeof value}`);
};

const computeSliceParams = (arrLength: number, slices: number): { sliceLength: number; extra: number } => {
  const sliceLength = Math.floor(arrLength / slices);
  const extra = arrLength % slices;
  return { sliceLength, extra };
};

const buildSingleSlice = (
  arr: unknown[],
  i: number,
  offset: number,
  sliceLength: number,
  extra: number,
  fillWith: unknown | undefined
): { slice: unknown[]; newOffset: number } => {
  const start = offset + (i * sliceLength);
  const newOffset = i < extra ? offset + 1 : offset;
  const end = newOffset + ((i + 1) * sliceLength);
  const currSlice = arr.slice(start, end);
  if (fillWith !== undefined && i >= extra) { currSlice.push(fillWith); }
  return { slice: currSlice, newOffset };
};

export const slice = (arr: unknown, slices: number, fillWith?: unknown): unknown[][] => {
  if (!isArray(arr)) { throw requireArrayError(arr, ERROR_DEFINITIONS.LIST_FILTER); }
  if (slices <= 0) {
    throw makeFilterError(ERROR_DEFINITIONS.SLICE_ZERO, {}, '', 'slices must be positive');
  }
  const { sliceLength, extra } = computeSliceParams(arr.length, slices);
  const { res } = pipe(
    range(0, slices),
    reduce(
      (acc, i) => {
        const { slice: currSlice, newOffset } = buildSingleSlice(arr, i, acc.offset, sliceLength, extra, fillWith);
        return { res: [...acc.res, currSlice], offset: newOffset };
      },
      { res: [] as unknown[][], offset: 0 },
    ),
  );
  return res;
};

const sumWithAttribute = (arr: unknown[], attr: string, start: number): number => {
  assertItemsHaveAttr(arr, attr, ERROR_DEFINITIONS.SUM_FILTER_ATTR);
  return start + sumValues(map(arr as Record<string, unknown>[], (v) => (v as Record<string, unknown>)[attr]) as number[]);
};

const sumWithoutAttribute = (arr: unknown[], start: number): number =>
  start + sumValues(arr as number[]);

export const sum = (arr: unknown, attr?: string, start = 0): number => {
  if (!(isArray(arr) || isPlainObject(arr))) {
    throw makeFilterError(ERROR_DEFINITIONS.SUM_FILTER, { type: typeof arr }, typeof arr, `Expected array or plain object but got ${typeof arr}`);
  }
  if (attr) {
    if (!isArray(arr)) { throw requireArrayError(arr, ERROR_DEFINITIONS.SUM_FILTER); }
    return sumWithAttribute(arr, attr, start);
  }
  if (!isArray(arr)) { throw requireArrayError(arr, ERROR_DEFINITIONS.SUM_FILTER); }
  return sumWithoutAttribute(arr, start);
};

const getCompareValue = (item: unknown, sortAttr: string | undefined): unknown => {
  if (!sortAttr) { return item; }
  return getAttrGetter(sortAttr)(item as Record<string, unknown>);
};

const toComparable = (value: unknown): string | number => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return String(value);
};

const compareValues = (xVal: unknown, yVal: unknown, caseSens: boolean | string | undefined, sortReverse: boolean | string | undefined): number => {
  const xRaw = toComparable(xVal);
  const yRaw = toComparable(yVal);
  const lower = !caseSens && isString(xRaw) && isString(yRaw);
  const x = lower ? xRaw.toLowerCase() : xRaw;
  const y = lower ? yRaw.toLowerCase() : yRaw;
  if (x < y) { return sortReverse ? 1 : -1; }
  if (x > y) { return sortReverse ? -1 : 1; }
  return 0;
};

const createSortComparator = (sortAttr: string | undefined, sortReverse: boolean | string | undefined, caseSens: boolean | string | undefined) => {
  return (a: unknown, b: unknown): number => {
    const xVal = getCompareValue(a, sortAttr);
    const yVal = getCompareValue(b, sortAttr);
    return compareValues(xVal, yVal, caseSens, sortReverse);
  };
};

const sortArray = (
  arr: unknown[],
  sortAttr: string | undefined,
  sortReverse: boolean | string | undefined,
  caseSens: boolean | string | undefined
): unknown[] => {
  if (sortAttr) {
    assertItemsHaveAttr(arr, sortAttr, ERROR_DEFINITIONS.SORT_FILTER_ATTR);
  }
  const array = [...arr];
  const comparator = createSortComparator(sortAttr, sortReverse, caseSens);
  return array.toSorted(comparator);
};

export const sort = makeComponent(
  ['value', 'reverse', 'case_sensitive', 'attribute'],
  [],
  (arr: unknown[], reversed?: boolean | string, caseSens?: boolean | string, attr?: string): unknown[] => {
    if (!isArray(arr)) { throw requireArrayError(arr, ERROR_DEFINITIONS.SORT_FILTER); }
    const reversedIsString = typeof reversed === 'string';
    const sortAttr = reversedIsString ? reversed : attr;
    const sortReverse = reversedIsString ? caseSens : reversed;
    return sortArray(arr, sortAttr, sortReverse, caseSens);
  }
);
