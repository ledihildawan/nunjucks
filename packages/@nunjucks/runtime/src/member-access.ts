// MEMBER ACCESS - Property lookup, slicing, and nullish coalescing
import { isNonNullish, isFunction, hasOwn } from '@nunjucks/shared/type-guards';
import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';

const NULL_MARKER = '__nunjucks_null__';
const PARENT_NAME = '__nunjucks_parent__';
const ACCESS_PATH = '__access_path__';
const PROP_NOT_FOUND = '__nunjucks_prop_not_found__';

export interface NullAccessResult {
  __nunjucks_null__: true;
  __nunjucks_parent__: string | null;
  __access_path__: string;
}

export interface PropertyNotFoundResult {
  __nunjucks_prop_not_found__: true;
  __nunjucks_parent__: string | null;
  __access_path__: string;
}

export type AccessResult = NullAccessResult | PropertyNotFoundResult | unknown;

export function memberLookup(obj: unknown, val: string, parentName: string | null = null): unknown {
  if (obj === null) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val };
  }

  const target = obj as Record<string, unknown>;
  if (!(hasOwn(target, val) || (val in target))) {
    const marker = { [PROP_NOT_FOUND]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val };
    const callable = (() => undefined) as unknown as Record<string, unknown>;
    Object.setPrototypeOf(callable, null);
    Object.assign(callable, marker);
    return callable;
  }

  if (isFunction(target[val])) {
    const fn = target[val] as (...args: unknown[]) => unknown;
    return (...args: unknown[]) => fn.apply(target, args);
  }

  return target[val];
}

export function isNullAccessResult(val: unknown): val is NullAccessResult {
  return isNonNullish(val) && typeof val === 'object' && (val as NullAccessResult).__nunjucks_null__ === true;
}

export function isPropertyNotFoundResult(val: unknown): val is PropertyNotFoundResult {
  return isNonNullish(val) && (val as PropertyNotFoundResult).__nunjucks_prop_not_found__ === true;
}

export function getNullParentName(val: unknown): string | null {
  if (!isNonNullish(val)) { return null; }
  return (val as NullAccessResult).__nunjucks_parent__ ?? null;
}

export function getAccessPath(val: unknown): string {
  if (!isNonNullish(val)) { return ''; }
  return (val as NullAccessResult).__access_path__ ?? '';
}

export function optionalMemberLookup(obj: unknown, val: string, _parentName: string | null = null): unknown {
  if (obj === null) {
    return ;
  }

  const target = obj as Record<string, unknown>;
  if (!(hasOwn(target, val) || (val in target))) {
    return ;
  }

  if (isFunction(target[val])) {
    const fn = target[val] as (...args: unknown[]) => unknown;
    return (...args: unknown[]) => fn.apply(target, args);
  }

  return target[val];
}

export function slice(arr: unknown[] | string, start: number | null, stop: number | null, step: number | null): unknown[] | string {
  if (step === 0) {
    throw createLog('error', ERROR_DEFINITIONS.SLICE_STEP!, {}, 'step', { phase: 'render', lineBase: 'zero' });
  }

  const len = (arr as { length: number }).length;
  let normalizedStart = start;
  let normalizedStop = stop;

  if (!isNonNullish(normalizedStart)) {
    if (step! < 0) {
      normalizedStart = len - 1;
    } else {
      normalizedStart = 0;
    }
  }
  if (!isNonNullish(normalizedStop)) {
    if (step! < 0) {
      normalizedStop = -1;
    } else {
      normalizedStop = len;
    }
  }

  const normalizeStart = (idx: number): number => {
    if (idx < 0) { return Math.max(0, len + idx); }
    return Math.min(len, idx);
  };

  normalizedStart = normalizeStart(normalizedStart as number);

  if (!isNonNullish(step) || step === 1) {
    if (typeof arr === 'string') {
      return (arr as unknown as { slice: (s: number, e: number) => string }).slice(normalizedStart, normalizedStop as number);
    }
    return (arr as unknown as { slice: (s: number, e: number) => unknown[] }).slice(normalizedStart, normalizedStop as number);
  }

  const result: unknown[] = [];
  if (step! > 0) {
    for (let i = normalizedStart; i < (normalizedStop as number); i += step!) {
      result.push((arr as unknown[])[i]);
    }
  } else {
    for (let i = normalizedStart; i >= 0 && i > (normalizedStop as number); i += step!) {
      result.push((arr as unknown[])[i]);
    }
  }
  return result;
}

export function nullishCoalesce(left: unknown, right: unknown): unknown {
  if (isNonNullish(left)) {
    return left;
  }
  return right;
}
