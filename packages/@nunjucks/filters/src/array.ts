import { createLog } from '@nunjucks/log';
import type { ErrorDefinitionEntry } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { isArray, isString, isPlainObject, map, keys, entries, sum as sumValues } from 'remeda';
import { isSafeString, copySafeness, makeMacro } from '@nunjucks/runtime';
import { getAttrGetter } from './attributes.ts';

type FilterContext = { logContext?: { templateName?: string; phase?: string; renderContext?: unknown } } | undefined;

const getLogContext = (ctx: FilterContext): { templateName: string; phase: string; renderContext: unknown } =>
  (ctx && ctx.logContext) ? { templateName: ctx.logContext.templateName || 'inline', phase: ctx.logContext.phase || 'render', renderContext: ctx.logContext.renderContext ?? null } : { templateName: 'inline', phase: 'render', renderContext: null };

const filterError = (ctx: FilterContext, errorDef: ErrorDefinitionEntry, params: Record<string, string>, subject: string) => {
  const logContext = getLogContext(ctx);
  return createLog('error', errorDef, params, subject, { phase: logContext.phase, templateName: logContext.templateName, lineBase: 'zero' });
};

export function batch(arr: unknown[], linecount: number, fillWith?: unknown): unknown[][] {
  const res: unknown[][] = [];
  let tmp: unknown[] = [];

  for (let i = 0; i < arr.length; i++) {
    if (i % linecount === 0 && tmp.length) {
      res.push(tmp);
      tmp = [];
    }

    tmp.push(arr[i]);
  }

  if (tmp.length) {
    if (fillWith !== undefined) {
      for (let i = tmp.length; i < linecount; i++) {
        tmp.push(fillWith);
      }
    }

    res.push(tmp);
  }

  return res;
}

export function first(arr: unknown[]): unknown {
  return arr[0];
}

export function last(arr: unknown[]): unknown {
  return arr.at(-1);
}

export function lengthFilter(val: unknown): number {
  const value: unknown = (val === null || val === undefined || val === false) ? '' : val;

  if (value !== undefined && value !== null) {
    if (typeof value === 'object' && (
      (typeof Map === 'function' && value instanceof Map) ||
      (typeof Set === 'function' && value instanceof Set)
    )) {
      return (value as Map<unknown, unknown> | Set<unknown>).size;
    }
    if (isPlainObject(value) && !isSafeString(value)) {
      return keys(value as Record<string, unknown>).length;
    }
    return (value as { length: number }).length;
  }
  return 0;
}

export function list(this: unknown, val: unknown): unknown[] | { key: string; value: unknown }[] {
  if (isString(val)) {
    return (val as string).split('');
  } else if (isPlainObject(val)) {
    return entries(val as Record<string, unknown>).map(([key, value]) => ({ key, value }));
  } else if (isArray(val)) {
    return val as unknown[];
  } else {
    throw filterError(this as FilterContext, ERROR_DEFINITIONS.LIST_FILTER!, { type: typeof val }, typeof val);
  }
}

export function random(arr: unknown[]): unknown {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function reverse(val: unknown): unknown {
  let arr: unknown[];
  if (isString(val)) {
    arr = list(val) as unknown[];
  } else {
    arr = map(val as unknown[], v => v);
  }

  arr = arr.toReversed();

  if (isString(val)) {
    return copySafeness(val as unknown as object, (arr as string[]).join(''));
  }
  return arr;
}

export function slice(arr: unknown[], slices: number, fillWith?: unknown): unknown[][] {
  const sliceLength = Math.floor(arr.length / slices);
  const extra = arr.length % slices;
  const res: unknown[][] = [];
  let offset = 0;

  for (let i = 0; i < slices; i++) {
    const start = offset + (i * sliceLength);
    if (i < extra) {
      offset++;
    }
    const end = offset + ((i + 1) * sliceLength);

    const currSlice = arr.slice(start, end);
    if (fillWith !== undefined && i >= extra) {
      currSlice.push(fillWith);
    }
    res.push(currSlice);
  }

  return res;
}

export function sum(arr: unknown[], attr?: string, start: number = 0): number {
  if (attr) {
    arr = map(arr, (v) => (v as Record<string, unknown>)[attr]);
  }

  return start + sumValues(arr as number[]);
}

export const sort = makeMacro(
  ['value', 'reverse', 'case_sensitive', 'attribute'], [],
  function sortFilter(this: unknown, arr: unknown[], reversed?: boolean | string, caseSens?: boolean, attr?: string): unknown[] {
    if (!arr || !Array.isArray(arr)) {
      throw filterError(this as FilterContext, ERROR_DEFINITIONS.SORT_FILTER!, { type: typeof arr }, typeof arr);
    }

    // Handle positional args: sort(items, attr) or sort(items, attr, reverse)
    // The attribute can be passed as 2nd arg (string) or 4th arg (keyword)
    let sortAttr: string | undefined = attr;
    let sortReverse = reversed;
    if (typeof reversed === 'string') {
      sortAttr = reversed;
      sortReverse = caseSens;
    }

    if (sortAttr) {
      for (const item of arr) {
        if (item && typeof item === 'object' && !(sortAttr in (item as object))) {
          throw filterError(this as FilterContext, ERROR_DEFINITIONS.SORT_FILTER_ATTR!, { attr: sortAttr }, sortAttr);
        }
      }
    }

    let array = map(arr, v => v);
    const getAttribute = getAttrGetter(sortAttr as string);

    array = array.toSorted((a, b) => {
      let x: string | number = (sortAttr) ? getAttribute(a as Record<string, unknown>) as string | number : a as string | number;
      let y: string | number = (sortAttr) ? getAttribute(b as Record<string, unknown>) as string | number : b as string | number;

      if (!caseSens && isString(x) && isString(y)) {
        x = (x as string).toLowerCase();
        y = (y as string).toLowerCase();
      }

      if (x < y) {
        return sortReverse ? 1 : -1;
      } else if (x > y) {
        return sortReverse ? -1 : 1;
      } else {
        return 0;
      }
    });

    return array;
  });

export function getSelectOrReject(expectedTestResult: boolean): (arr: unknown[], testName?: string, secondArg?: unknown) => unknown[] {
  function filter(this: FilterContext, arr: unknown[], testName: string = 'truthy', secondArg?: unknown): unknown[] {
    const context = this;
    const test = (context as { env: { getTest: (name: string) => (this: unknown, ...args: unknown[]) => boolean } }).env.getTest(testName);

    return Array.from(arr).filter((item) => {
      return test.call(context, item, secondArg) === expectedTestResult;
    });
  }

  return filter;
}

export const reject = getSelectOrReject(false);

export function rejectattr(arr: Record<string, unknown>[], attr: string): Record<string, unknown>[] {
  return arr.filter((item) => !item[attr]);
}

export const select = getSelectOrReject(true);

export function selectattr(arr: Record<string, unknown>[], attr: string): Record<string, unknown>[] {
  return arr.filter((item) => Boolean(item[attr]));
}
