// MEMBER ACCESS - Property lookup, slicing, and nullish coalescing
import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';

const isNonNullish = (v: unknown): boolean => v !== null && v !== undefined;
const isFunction = (v: unknown): boolean => typeof v === 'function';

const NULL_MARKER = '__nunjucks_null__';
const PARENT_NAME = '__nunjucks_parent__';
const ACCESS_PATH = '__access_path__';
const PROP_NOT_FOUND = '__nunjucks_prop_not_found__';

export interface NullAccessResult {
  __nunjucks_null__: true;
  __nunjucks_parent__: string | null;
  __access_path__: string;
}

export function memberLookup(obj: unknown, val: string, parentName: string | null = null): unknown {
  if (obj == null) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val };
  }

  const target = obj as Record<string, unknown>;
  if (!Object.hasOwn(target, val) && !(val in target)) {
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

export function isNullAccessResult(val: unknown): boolean {
  return !!val && typeof val === 'object' && (val as { __nunjucks_null__?: boolean }).__nunjucks_null__ === true;
}

export function isPropertyNotFoundResult(val: unknown): boolean {
  return !!val && (val as { __nunjucks_prop_not_found__?: boolean }).__nunjucks_prop_not_found__ === true;
}

export function getNullParentName(val: unknown): string | null {
  return ((val && (val as { __nunjucks_parent__?: string }).__nunjucks_parent__) ?? null) as string | null;
}

export function getAccessPath(val: unknown): string {
  return (val && (val as { __access_path__?: string }).__access_path__) as string;
}

export function optionalMemberLookup(obj: unknown, val: string, parentName: string | null = null): unknown {
  if (obj == null) {
    return undefined;
  }

  const target = obj as Record<string, unknown>;
  if (!Object.hasOwn(target, val) && !(val in target)) {
    return undefined;
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
    normalizedStart = (step! < 0) ? len - 1 : 0;
  }
  if (!isNonNullish(normalizedStop)) {
    normalizedStop = (step! < 0) ? -1 : len;
  }

  const normalizeStart = (idx: number): number => {
    if (idx < 0) return Math.max(0, len + idx);
    return Math.min(len, idx);
  };

  normalizedStart = normalizeStart(normalizedStart as number);

  if (!isNonNullish(step) || step === 1) {
    if (typeof arr === 'string') {
      return (arr as unknown as { slice(s: number, e: number): string }).slice(normalizedStart, normalizedStop as number);
    }
    return (arr as unknown as { slice(s: number, e: number): unknown[] }).slice(normalizedStart, normalizedStop as number);
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
  return isNonNullish(left) ? left : right;
}
