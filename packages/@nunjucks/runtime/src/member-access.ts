import { isNonNullish, isFunction, hasOwn } from '@nunjucks/shared';
import { createLog } from '@nunjucks/error-formatter';
import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';

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

export type AccessResult = NullAccessResult | PropertyNotFoundResult;

export const memberLookup = (target: unknown, value: string, parentName: string | null = null): unknown => {
  if (target === null || target === undefined) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value };
  }

  const record = target as Record<string, unknown>;
  const hasProperty = hasOwn(record, value)
    || (typeof target === 'object' || typeof target === 'function'
      ? (value in record)
      : (value in Object(target)));

  if (!hasProperty) {
    const marker = { [PROP_NOT_FOUND]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value };
    const callable = Object.assign(() => undefined, marker);
    Object.setPrototypeOf(callable, null);
    return callable;
  }

  if (isFunction(record[value])) {
    const fn = record[value];
    return <A extends unknown[]>(...args: A): unknown => Reflect.apply(fn, record, args) as unknown;
  }

  return record[value];
};

export const isNullAccessResult = (value: unknown): value is NullAccessResult => {
  return isNonNullish(value) && typeof value === 'object' && (value as NullAccessResult).__nunjucks_null__ === true;
};

export const isPropertyNotFoundResult = (value: unknown): value is PropertyNotFoundResult => {
  return isNonNullish(value) && (value as PropertyNotFoundResult).__nunjucks_prop_not_found__ === true;
};

export const getNullParentName = (value: unknown): string | null => {
  if (!isNonNullish(value)) { return null; }
  return (value as NullAccessResult).__nunjucks_parent__ ?? null;
};

export const optionalMemberLookup = (target: unknown, value: string, parentName: string | null = null): unknown => {
  const result = memberLookup(target, value, parentName);
  if (isNullAccessResult(result) || isPropertyNotFoundResult(result)) {
    return;
  }
  return result;
};

interface NormalizeIndexInput {
  idx: number | null;
  len: number;
  defaultVal: number;
  step: number;
}

const normalizeIndex = ({ idx, len, defaultVal, step }: NormalizeIndexInput): number => {
  if (!isNonNullish(idx)) {
    if (step < 0) {
      return defaultVal === 0 ? len - 1 : -1;
    }
    return defaultVal;
  }
  return Math.max(0, Math.min(len, idx < 0 ? len + idx : idx));
};

export const slice = <T>(source: readonly T[] | string, start: number | null, stop: number | null, step: number | null): readonly T[] | string => {
  if (step === 0) {
    throw createLog('error', { def: ERROR_DEFINITIONS.SLICE_STEP, params: {}, subject: 'step', context: { phase: 'render', lineBase: 'zero' } });
  }

  const len = source.length;
  const stepValue = step ?? 1;
  const normalizedStart = normalizeIndex({ idx: start, len, defaultVal: 0, step: stepValue });
  const normalizedStop = normalizeIndex({ idx: stop, len, defaultVal: stepValue < 0 ? -1 : len, step: stepValue });

  if (stepValue === 1) {
    return source.slice(normalizedStart, normalizedStop);
  }

  if (stepValue > 0) {
    const collectForward = (i: number, acc: T[]): readonly T[] => {
      if (i >= normalizedStop) { return acc; }
      return collectForward(i + stepValue, [...acc, source[i] as T]);
    };
    return collectForward(normalizedStart, []);
  }

  const collectBackward = (i: number, acc: T[]): readonly T[] => {
    if (i < 0 || i <= normalizedStop) { return acc; }
    return collectBackward(i + stepValue, [...acc, source[i] as T]);
  };
  return collectBackward(normalizedStart, []);
};

export { nullishCoalesce } from '@nunjucks/lib/nullish-coalesce';
