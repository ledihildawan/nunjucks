import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import {
  collectBackward,
  collectForward,
  hasOwn,
  isFunction,
  isNonNullish,
  normalizeIndex,
} from '@nunjucks/lib';
import { isPrototypeEscapeKey } from '@nunjucks/shared';

export const NULL_MARKER = '__nunjucks_null__';
export const PARENT_NAME = '__nunjucks_parent__';
export const ACCESS_PATH = '__nunjucks_access_path__';
export const PROP_NOT_FOUND = '__nunjucks_prop_not_found__';

export interface NullAccessResult {
  __nunjucks_null__: true;
  __nunjucks_parent__: string | null;
  __nunjucks_access_path__: string;
}

export interface PropertyNotFoundResult {
  __nunjucks_prop_not_found__: true;
  __nunjucks_parent__: string | null;
  __nunjucks_access_path__: string;
}

export const memberLookup = (
  target: unknown,
  value: string,
  parentName: string | null = null
): unknown => {
  if (target === null || target === undefined) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value };
  }

  const record = target as Record<string, unknown>;
  // WHY: RCE guard — `x.constructor.constructor("...")()` reaches the Function constructor
  // through INHERITED properties. Prototype-escape keys are therefore treated as absent
  // unless the host explicitly placed them as own properties (sandbox still polices that
  // case). Unconditional: code execution must not depend on the host enabling the sandbox.
  if (isPrototypeEscapeKey(value) && !hasOwn(record, value)) {
    const marker = { [PROP_NOT_FOUND]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value };
    const callable = Object.assign(() => undefined, marker);
    Object.setPrototypeOf(callable, null);
    return callable;
  }
  const hasProperty =
    hasOwn(record, value) ||
    (typeof target === 'object' || typeof target === 'function'
      ? value in record
      : value in Object(target));

  if (!hasProperty) {
    // WHY: the not-found sentinel is a CALLABLE object — templates that invoke a missing
    // method (`{{ user.missing() }}`) flow through call-wrap, which applies the function and
    // yields undefined instead of crashing; the discriminator guards
    // (isPropertyNotFoundResult) and optionalMemberLookup bridge the same state back into
    // the value channel for non-call sites. Documented in ARCHITECTURE.md §7 sentinels.
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
  return (
    isNonNullish(value) &&
    typeof value === 'object' &&
    (value as NullAccessResult).__nunjucks_null__ === true
  );
};

export const isPropertyNotFoundResult = (value: unknown): value is PropertyNotFoundResult => {
  return (
    isNonNullish(value) && (value as PropertyNotFoundResult).__nunjucks_prop_not_found__ === true
  );
};

export const getNullParentName = (value: unknown): string | null => {
  if (!isNullAccessResult(value)) {
    return null;
  }
  return value.__nunjucks_parent__ ?? null;
};

export const optionalMemberLookup = (
  target: unknown,
  value: string,
  parentName: string | null = null
): unknown => {
  const result = memberLookup(target, value, parentName);
  if (isNullAccessResult(result) || isPropertyNotFoundResult(result)) {
    return;
  }
  return result;
};

interface SliceOptions {
  source: readonly unknown[] | string;
  start: number | null;
  stop: number | null;
  step: number | null;
}

export const slice = (options: SliceOptions): readonly unknown[] | string => {
  const { source, start, stop, step } = options;
  if (step === 0) {
    throw createLog('error', {
      def: ERROR_DEFINITIONS.SLICE_STEP,
      params: {},
      subject: 'step',
      context: { phase: 'render', lineBase: 'zero' },
    });
  }

  const len = source.length;
  const stepValue = step ?? 1;
  const normalizedStart = normalizeIndex({ idx: start, len, defaultVal: 0, step: stepValue });
  const normalizedStop = normalizeIndex({
    idx: stop,
    len,
    defaultVal: stepValue < 0 ? -1 : len,
    step: stepValue,
  });

  if (stepValue === 1) {
    return source.slice(normalizedStart, normalizedStop);
  }

  if (stepValue > 0) {
    return collectForward({
      source,
      start: normalizedStart,
      stop: normalizedStop,
      step: stepValue,
    });
  }

  return collectBackward({ source, start: normalizedStart, stop: normalizedStop, step: stepValue });
};
