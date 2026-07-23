import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { isString, isPlainObject, map, sum as sumValues } from 'remeda';
import { isSafeString, makeMacro } from '@nunjucks/runtime';
import { filterError, isArray } from '../factory/index.ts';
import type { FilterContext } from '../factory/index.ts';

export { filterError };
export type { FilterContext };

export const first = (arr: unknown): unknown => {
  if (!isArray(arr)) {
    throw filterError(undefined, ERROR_DEFINITIONS.FIRST_LAST_FILTER!, { type: typeof arr }, typeof arr);
  }
  return arr[0];
};

export const last = (arr: unknown): unknown => {
  if (!isArray(arr)) {
    throw filterError(undefined, ERROR_DEFINITIONS.FIRST_LAST_FILTER!, { type: typeof arr }, typeof arr);
  }
  return arr.at(-1);
};

export const lengthFilter = (val: unknown): number => {
  const value: unknown = (val === null || val === undefined || val === false) ? '' : val;
  if (value !== undefined && value !== null) {
    if (typeof value === 'object' && ((typeof Map === 'function' && value instanceof Map) || (typeof Set === 'function' && value instanceof Set))) {
      return (value as Map<unknown, unknown> | Set<unknown>).size;
    }
    if (isPlainObject(value) && !isSafeString(value)) {
      return Object.keys(value as Record<string, unknown>).length;
    }
    return (value as { length: number }).length;
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
    throw filterError(undefined, ERROR_DEFINITIONS.LIST_FILTER!, { type: typeof val }, typeof val);
  }
  arr = arr.toReversed();
  if (typeof val === 'string') return (arr as string[]).join('');
  return arr;
};

export const slice = (arr: unknown, slices: number, fillWith?: unknown): unknown[][] => {
  if (!isArray(arr)) {
    throw filterError(undefined, ERROR_DEFINITIONS.LIST_FILTER!, { type: typeof arr }, typeof arr);
  }
  if (slices <= 0) {
    throw filterError(undefined, ERROR_DEFINITIONS.SLICE_ZERO!, {}, '');
  }
  const sliceLength = Math.floor(arr.length / slices);
  const extra = arr.length % slices;
  const res: unknown[][] = [];
  let offset = 0;
  for (let i = 0; i < slices; i++) {
    const start = offset + (i * sliceLength);
    if (i < extra) offset++;
    const end = offset + ((i + 1) * sliceLength);
    const currSlice = arr.slice(start, end);
    if (fillWith !== undefined && i >= extra) currSlice.push(fillWith);
    res.push(currSlice);
  }
  return res;
};

export const sum = (arr: unknown, attr?: string, start: number = 0): number => {
  if (!isArray(arr) && !isPlainObject(arr)) {
    throw filterError(undefined, ERROR_DEFINITIONS.SUM_FILTER!, { type: typeof arr }, typeof arr);
  }
  if (attr) {
    if (!isArray(arr)) {
      throw filterError(undefined, ERROR_DEFINITIONS.SUM_FILTER!, { type: typeof arr }, typeof arr);
    }
    for (const item of arr) {
      if (item && typeof item === 'object' && !(attr in (item as object))) {
        throw filterError(undefined, ERROR_DEFINITIONS.SUM_FILTER_ATTR!, { attr }, attr);
      }
    }
    arr = map(arr as Record<string, unknown>[], (v) => (v as Record<string, unknown>)[attr]);
  }
  return start + sumValues(arr as number[]);
};

export const sort = makeMacro(
  ['value', 'reverse', 'case_sensitive', 'attribute'],
  [],
  (arr: unknown[], reversed?: boolean | string, caseSens?: boolean | string, attr?: string): unknown[] => {
    if (!isArray(arr)) {
      throw filterError(undefined, ERROR_DEFINITIONS.SORT_FILTER!, { type: typeof arr }, typeof arr);
    }
    let sortAttr: string | undefined = attr;
    let sortReverse = reversed;
    if (typeof reversed === 'string') {
      sortAttr = reversed;
      sortReverse = caseSens;
    }
    if (sortAttr) {
      for (const item of arr) {
        if (item && typeof item === 'object' && !(sortAttr in (item as object))) {
          throw filterError(undefined, ERROR_DEFINITIONS.SORT_FILTER_ATTR!, { attr: sortAttr }, sortAttr);
        }
      }
    }
    let array = map(arr, (v) => v);
    array = array.toSorted((a, b) => {
      const getAttribute = (obj: Record<string, unknown>): unknown => {
        if (!sortAttr) return obj;
        const keys = sortAttr.split('.');
        let val: unknown = obj;
        for (const k of keys) {
          val = (val as Record<string, unknown>)[k];
        }
        return val;
      };
      let x: string | number = sortAttr ? getAttribute(a as Record<string, unknown>) as string | number : a as string | number;
      let y: string | number = sortAttr ? getAttribute(b as Record<string, unknown>) as string | number : b as string | number;
      if (!caseSens && isString(x) && isString(y)) {
        x = (x as string).toLowerCase();
        y = (y as string).toLowerCase();
      }
      if (x < y) return sortReverse ? 1 : -1;
      if (x > y) return sortReverse ? -1 : 1;
      return 0;
    });
    return array;
  }
);

export const getSelectOrReject = (expectedTestResult: boolean) =>
  function (this: FilterContext, arr: unknown[], testName: string = 'truthy', secondArg?: unknown): unknown[] {
    if (!isArray(arr)) {
      throw filterError(undefined, ERROR_DEFINITIONS.LIST_FILTER!, { type: typeof arr }, typeof arr);
    }
    const context = this;
    const test = (context as { env: { getTest: (name: string) => (this: unknown, ...args: unknown[]) => boolean } }).env.getTest(testName);
    return Array.from(arr).filter((item) => test.call(context, item, secondArg) === expectedTestResult);
  };

export const reject = getSelectOrReject(false);

export const select = getSelectOrReject(true);
