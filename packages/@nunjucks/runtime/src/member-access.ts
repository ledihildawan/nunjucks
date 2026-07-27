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
  if (obj === null || obj === undefined) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val };
  }

  const target = obj as Record<string, unknown>;
  if (!(hasOwn(target, val) || (val in target))) {
    const marker = { [PROP_NOT_FOUND]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val };
    const callable = Object.assign(() => undefined, marker);
    Object.setPrototypeOf(callable, null);
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
  // `val` is only *maybe* a NullAccessResult, so the cast is partial and the
  // `??` is what covers everything else that reaches this function.
  return (val as Partial<NullAccessResult>).__access_path__ ?? '';
}

export function optionalMemberLookup(obj: unknown, val: string, _parentName: string | null = null): unknown {
  if (obj === null || obj === undefined) {
    return;
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
    throw createLog('error', ERROR_DEFINITIONS.SLICE_STEP, {}, 'step', { phase: 'render', lineBase: 'zero' });
  }

  const len = arr.length;
  const stepValue = step ?? 1;
  const normalizedStart = !isNonNullish(start)
    ? (stepValue < 0 ? len - 1 : 0)
    : Math.max(0, Math.min(len, start < 0 ? len + start : start));
  const normalizedStop = !isNonNullish(stop)
    ? (stepValue < 0 ? -1 : len)
    : Math.max(0, Math.min(len, stop < 0 ? len + stop : stop));

  if (stepValue === 1) {
    return arr.slice(normalizedStart, normalizedStop);
  }

  const buildResult = (): unknown[] => {
    const result: unknown[] = [];
    if (stepValue > 0) {
      for (let i = normalizedStart; i < normalizedStop; i += stepValue) {
        result.push(arr[i]);
      }
    } else {
      for (let i = normalizedStart; i >= 0 && i > normalizedStop; i += stepValue) {
        result.push(arr[i]);
      }
    }
    return result;
  };

  return buildResult();
}

export function nullishCoalesce(left: unknown, right: unknown): unknown {
  if (isNonNullish(left)) {
    return left;
  }
  return right;
}
