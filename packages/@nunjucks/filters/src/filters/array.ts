import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { isString, isPlainObject, map, sum as sumValues } from 'remeda';
import { isSafeString, makeMacro } from '@nunjucks/runtime';
import { filterError, isArray } from '../factory/index.ts';
import type { FilterContext } from '../factory/index.ts';

export { filterError } from '../factory/index.ts';
export type { FilterContext } from '../factory/index.ts';

export const first = (arr: unknown): unknown => {
  if (!isArray(arr)) {
    const errorDef = ERROR_DEFINITIONS.FIRST_LAST_FILTER;
    if (errorDef) {
      throw filterError(undefined, errorDef, { type: typeof arr }, typeof arr);
    }
    throw new Error(`Expected array but got ${typeof arr}`);
  }
  return arr[0];
};

export const last = (arr: unknown): unknown => {
  if (!isArray(arr)) {
    const errorDef = ERROR_DEFINITIONS.FIRST_LAST_FILTER;
    if (errorDef) {
      throw filterError(undefined, errorDef, { type: typeof arr }, typeof arr);
    }
    throw new Error(`Expected array but got ${typeof arr}`);
  }
  return arr.at(-1);
};

const isMapOrSet = (value: unknown): boolean =>
  typeof Map === 'function' && (value instanceof Map || value instanceof Set);

const getCollectionSize = (value: unknown): number =>
  (value as Map<unknown, unknown> | Set<unknown>).size;

const getObjectLength = (value: unknown): number =>
  Object.keys(value as Record<string, unknown>).length;

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
  let value: unknown;
  if (val === null || val === undefined || val === false) {
    value = '';
  } else {
    value = val;
  }
  if (value !== undefined && value !== null) {
    return getLengthFromValue(value);
  }
  return 0;
};

export const reverse = (val: unknown): unknown[] | string => {
  let arr: unknown[];
  if (typeof val === 'string') {
    arr = val.split('');
  } else if (isArray(val)) {
    arr = map(val, (v) => v);
  } else {
    const errorDef = ERROR_DEFINITIONS.LIST_FILTER;
    if (errorDef) {
      throw filterError(undefined, errorDef, { type: typeof val }, typeof val);
    }
    throw new Error(`Expected string or array but got ${typeof val}`);
  }
  arr = arr.toReversed();
  if (typeof val === 'string') { return (arr as string[]).join(''); }
  return arr;
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
  if (!isArray(arr)) {
    const errorDef = ERROR_DEFINITIONS.LIST_FILTER;
    if (errorDef) {
      throw filterError(undefined, errorDef, { type: typeof arr }, typeof arr);
    }
    throw new Error(`Expected array but got ${typeof arr}`);
  }
  if (slices <= 0) {
    const errorDef = ERROR_DEFINITIONS.SLICE_ZERO;
    if (errorDef) {
      throw filterError(undefined, errorDef, {}, '');
    }
    throw new Error('slices must be positive');
  }
  const { sliceLength, extra } = computeSliceParams(arr.length, slices);
  const res: unknown[][] = [];
  let offset = 0;
  for (let i = 0; i < slices; i += 1) {
    const { slice: currSlice, newOffset } = buildSingleSlice(arr, i, offset, sliceLength, extra, fillWith);
    offset = newOffset;
    res.push(currSlice);
  }
  return res;
};

const validateSumAttribute = (arr: unknown[], attr: string): void => {
  for (const item of arr) {
    if (item && typeof item === 'object' && !(attr in (item as object))) {
      const errorDef = ERROR_DEFINITIONS.SUM_FILTER_ATTR;
      if (errorDef) {
        throw filterError(undefined, errorDef, { attr }, attr);
      }
      throw new Error(`Attribute "${attr}" not found in item`);
    }
  }
};

const sumWithAttribute = (arr: unknown[], attr: string, start: number): number => {
  validateSumAttribute(arr, attr);
  return start + sumValues(map(arr as Record<string, unknown>[], (v) => (v as Record<string, unknown>)[attr]) as number[]);
};

const sumWithoutAttribute = (arr: unknown[], start: number): number =>
  start + sumValues(arr as number[]);

export const sum = (arr: unknown, attr?: string, start = 0): number => {
  if (!(isArray(arr) || isPlainObject(arr))) {
    const errorDef = ERROR_DEFINITIONS.SUM_FILTER;
    if (errorDef) {
      throw filterError(undefined, errorDef, { type: typeof arr }, typeof arr);
    }
    throw new Error(`Expected array or plain object but got ${typeof arr}`);
  }
  if (attr) {
    if (!isArray(arr)) {
      const errorDef = ERROR_DEFINITIONS.SUM_FILTER;
      if (errorDef) {
        throw filterError(undefined, errorDef, { type: typeof arr }, typeof arr);
      }
      throw new Error(`Expected array but got ${typeof arr}`);
    }
    return sumWithAttribute(arr, attr, start);
  }
  return sumWithoutAttribute(arr, start);
};

const getNestedAttribute = (obj: Record<string, unknown>, attr: string): unknown => {
  const keys = attr.split('.');
  let val: unknown = obj;
  for (const k of keys) {
    val = (val as Record<string, unknown>)[k];
  }
  return val;
};

const getCompareValue = (item: unknown, sortAttr: string | undefined): unknown => {
  if (!sortAttr) { return item; }
  return getNestedAttribute(item as Record<string, unknown>, sortAttr);
};

const toComparable = (val: unknown): string | number => {
  if (typeof val === 'string' || typeof val === 'number') {
    return val as string | number;
  }
  return String(val) as string | number;
};

const compareValues = (xVal: unknown, yVal: unknown, caseSens: boolean | string | undefined, sortReverse: boolean | string | undefined): number => {
  let x = toComparable(xVal);
  let y = toComparable(yVal);
  if (!caseSens && isString(x) && isString(y)) {
    x = (x as string).toLowerCase();
    y = (y as string).toLowerCase();
  }
  if (x < y) { return sortReverse ? 1 : -1; }
  if (x > y) { return sortReverse ? -1 : 1; }
  return 0;
};

const validateSortAttribute = (arr: unknown[], sortAttr: string): void => {
  for (const item of arr) {
    if (item && typeof item === 'object' && !(sortAttr in (item as object))) {
      const errorDef = ERROR_DEFINITIONS.SORT_FILTER_ATTR;
      if (errorDef) {
        throw filterError(undefined, errorDef, { attr: sortAttr }, sortAttr);
      }
      throw new Error(`Attribute "${sortAttr}" not found in item`);
    }
  }
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
    validateSortAttribute(arr, sortAttr);
  }
  const array = map(arr, (v) => v);
  const comparator = createSortComparator(sortAttr, sortReverse, caseSens);
  return array.toSorted(comparator);
};

export const sort = makeMacro(
  ['value', 'reverse', 'case_sensitive', 'attribute'],
  [],
  (arr: unknown[], reversed?: boolean | string, caseSens?: boolean | string, attr?: string): unknown[] => {
    if (!isArray(arr)) {
      const errorDef = ERROR_DEFINITIONS.SORT_FILTER;
      if (errorDef) {
        throw filterError(undefined, errorDef, { type: typeof arr }, typeof arr);
      }
      throw new Error(`Expected array but got ${typeof arr}`);
    }
    let sortAttr: string | undefined = attr;
    let sortReverse = reversed;
    if (typeof reversed === 'string') {
      sortAttr = reversed;
      sortReverse = caseSens;
    }
    return sortArray(arr, sortAttr, sortReverse, caseSens);
  }
);

export const getSelectOrReject = (expectedTestResult: boolean) =>
  function (this: FilterContext, arr: unknown[], testName = 'truthy', secondArg?: unknown): unknown[] {
    if (!isArray(arr)) {
      const errorDef = ERROR_DEFINITIONS.LIST_FILTER;
      if (errorDef) {
        throw filterError(undefined, errorDef, { type: typeof arr }, typeof arr);
      }
      throw new Error(`Expected array but got ${typeof arr}`);
    }
    const test = (this as { env: { getTest: (name: string) => (this: unknown, ...args: unknown[]) => boolean } }).env.getTest(testName);
    return Array.from(arr).filter((item) => test.call(this, item, secondArg) === expectedTestResult);
  };

export const reject = getSelectOrReject(false);

export const select = getSelectOrReject(true);
