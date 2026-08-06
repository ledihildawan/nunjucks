import { isNonNullish, isFunction, hasOwn } from '@nunjucks/shared';
import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';

export const NULL_MARKER = '__nunjucks_null__';
export const PARENT_NAME = '__nunjucks_parent__';
export const ACCESS_PATH = '__access_path__';
export const PROP_NOT_FOUND = '__nunjucks_prop_not_found__';

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

/**
 * Union of the two "marker" objects that `memberLookup` may return to signal
 * an access that should be treated as undefined-ish (null intermediate, or
 * missing property). `memberLookup` itself returns `unknown` (marker OR real
 * value); use the `isNullAccessResult` / `isPropertyNotFoundResult` type guards
 * to narrow at the call site.
 */
export type AccessResult = NullAccessResult | PropertyNotFoundResult;

export const memberLookup = (obj: unknown, val: string, parentName: string | null = null): unknown => {
  if (obj === null || obj === undefined) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val };
  }

  const target = obj as Record<string, unknown>;
  const hasProperty = hasOwn(target, val) || (typeof obj === 'object' || typeof obj === 'function' ? (val in target) : (val in Object(obj)));

  if (!hasProperty) {
    const marker = { [PROP_NOT_FOUND]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val };
    const callable = Object.assign(() => undefined, marker);
    Object.setPrototypeOf(callable, null);
    return callable;
  }

  if (isFunction(target[val])) {
    const fn = target[val];
    return (...args: unknown[]) => Reflect.apply(fn, target, args);
  }

  return target[val];
};

export const isNullAccessResult = (val: unknown): val is NullAccessResult => {
  return isNonNullish(val) && typeof val === 'object' && (val as NullAccessResult).__nunjucks_null__ === true;
};

export const isPropertyNotFoundResult = (val: unknown): val is PropertyNotFoundResult => {
  return isNonNullish(val) && (val as PropertyNotFoundResult).__nunjucks_prop_not_found__ === true;
};

export const getNullParentName = (val: unknown): string | null => {
  if (!isNonNullish(val)) { return null; }
  return (val as NullAccessResult).__nunjucks_parent__ ?? null;
};

export const optionalMemberLookup = (obj: unknown, val: string, parentName: string | null = null): unknown => {
  const result = memberLookup(obj, val, parentName);
  if (isNullAccessResult(result) || isPropertyNotFoundResult(result)) {
    return;
  }
  return result;
};

const normalizeIndex = (idx: number | null, len: number, defaultVal: number, stepValue: number): number => {
  if (!isNonNullish(idx)) {
    if (stepValue < 0) {
      return defaultVal === 0 ? len - 1 : -1;
    }
    return defaultVal;
  }
  return Math.max(0, Math.min(len, idx < 0 ? len + idx : idx));
};

export const slice = <T>(arr: readonly T[] | string, start: number | null, stop: number | null, step: number | null): readonly T[] | string => {
  if (step === 0) {
    throw createLog('error', ERROR_DEFINITIONS.SLICE_STEP, {}, 'step', { phase: 'render', lineBase: 'zero' });
  }

  const len = arr.length;
  const stepValue = step ?? 1;
  const normalizedStart = normalizeIndex(start, len, 0, stepValue);
  const normalizedStop = normalizeIndex(stop, len, stepValue < 0 ? -1 : len, stepValue);

  if (stepValue === 1) {
    return arr.slice(normalizedStart, normalizedStop);
  }

  const buildResult = (): T[] => {
    const result: T[] = [];
    if (stepValue > 0) {
      for (let i = normalizedStart; i < normalizedStop; i += stepValue) {
        result.push(arr[i] as T);
      }
    } else {
      for (let i = normalizedStart; i >= 0 && i > normalizedStop; i += stepValue) {
        result.push(arr[i] as T);
      }
    }
    return result;
  };

  return buildResult();
};

export const nullishCoalesce = <T>(left: T | null | undefined, right: T): T => {
  if (isNonNullish(left)) {
    return left;
  }
  return right;
};
