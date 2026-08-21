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
import { isPrototypeEscapeKey } from '@nunjucks/security';

/** Marker key identifying a null-access sentinel from reading a member of `null`/`undefined`. */
export const NULL_MARKER = '__nunjucks_null__';
/** Sentinel field carrying the display name of the object the failed access started from. */
export const PARENT_NAME = '__nunjucks_parent__';
/** Sentinel field carrying the human-readable access path of the failed lookup. */
export const ACCESS_PATH = '__nunjucks_access_path__';
/** Marker key identifying a property-not-found callable sentinel. */
export const PROP_NOT_FOUND = '__nunjucks_prop_not_found__';

/**
 * Sentinel object returned when a member is read off `null` or `undefined`;
 * carries the parent name and access path for undefined-mode messages.
 */
export interface NullAccessResult {
  __nunjucks_null__: true;
  __nunjucks_parent__: string | null;
  __nunjucks_access_path__: string;
}

/**
 * Shape of the null-prototype not-found callable; the marker fields feed the
 * guard predicates and undefined-mode messages.
 */
export interface PropertyNotFoundResult {
  __nunjucks_prop_not_found__: true;
  __nunjucks_parent__: string | null;
  __nunjucks_access_path__: string;
}

/** The not-found sentinel in callable form: invoking it yields `undefined`. */
export type PropertyNotFoundCallable = (() => undefined) & PropertyNotFoundResult;

// WHY: shared factory — memberLookup and the sandbox member-access wrapper build the identical
// null-prototype not-found callable; one factory keeps the sentinel shape from drifting.
// Symbols coerce to their description — the access path feeds human-readable undefined
// messages (undefined-rules.ts), which require a string.
export const createPropertyNotFoundCallable = (
  value: string | symbol,
  parentName: string | null
): PropertyNotFoundCallable => {
  const accessPath = typeof value === 'symbol' ? (value.description ?? String(value)) : value;
  const marker: PropertyNotFoundCallable = Object.assign(() => undefined, {
    [PROP_NOT_FOUND]: true as const,
    [PARENT_NAME]: parentName,
    [ACCESS_PATH]: accessPath,
  });
  Object.setPrototypeOf(marker, null);
  return marker;
};

/**
 * Reads `target[value]` for generated code, returning typed miss sentinels —
 * null-access objects or not-found callables — instead of throwing, wrapping
 * method reads in closures bound to their receiver, and treating
 * prototype-escape keys (`constructor`, `__proto__`, `prototype`) as own
 * properties only so `x.constructor.constructor` cannot reach `Function`.
 */
// WHY: `string | symbol` — the sandboxed runtime (executor-runtime.ts) routes symbol-keyed
// reads through this same funnel; the sentinel factory already coerces symbols for the
// human-readable access path.
export const memberLookup = (
  target: unknown,
  value: string | symbol,
  parentName: string | null = null
): unknown => {
  if (target === null || target === undefined) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value };
  }

  // WHY: null/undefined is handled above; every remaining value supports keyed reads
  // (primitives box transparently), so the index signature is a dynamic-read model, not a shape claim.
  const record = target as Record<string | symbol, unknown>;
  // WHY: RCE guard — `x.constructor.constructor("...")()` reaches the Function constructor
  // through INHERITED properties. Prototype-escape keys are therefore treated as absent
  // unless the host explicitly placed them as own properties (sandbox still polices that
  // case). Unconditional: code execution must not depend on the host enabling the sandbox.
  // Symbols are never escape keys — the guard is string-only.
  if (typeof value === 'string' && isPrototypeEscapeKey(value) && !hasOwn(record, value)) {
    return createPropertyNotFoundCallable(value, parentName);
  }
  // WHY: outside sandbox mode, INHERITED non-escape members (`{{ user.toString }}`,
  // class getters) stay readable to mirror JS member semantics; the sandbox's own-only
  // traps and contextStrict's intrinsic flags are the opt-ins that tighten this.
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
    // the value channel for non-call sites.
    return createPropertyNotFoundCallable(value, parentName);
  }

  if (isFunction(record[value])) {
    const fn = record[value];
    // WHY: Reflect.apply returns any; routing it through unknown keeps the no-any discipline
    // on the result of a dynamically-applied function.
    return <A extends unknown[]>(...args: A): unknown => Reflect.apply(fn, record, args) as unknown;
  }

  return record[value];
};

/** Narrows to the null-access sentinel (`__nunjucks_null__`). */
export const isNullAccessResult = (value: unknown): value is NullAccessResult => {
  return (
    isNonNullish(value) &&
    typeof value === 'object' &&
    (value as NullAccessResult).__nunjucks_null__ === true
  );
};

/** Narrows to the not-found sentinel (`__nunjucks_prop_not_found__`). */
export const isPropertyNotFoundResult = (value: unknown): value is PropertyNotFoundResult => {
  return (
    isNonNullish(value) && (value as PropertyNotFoundResult).__nunjucks_prop_not_found__ === true
  );
};

// WHY: single union check for both miss sentinels — consumers that only need "is this an
// absent lookup" (truthiness folding, filter-arg normalization, predicates) should not
// care which kind of miss produced it.
export const isAbsentLookupResult = (value: unknown): boolean =>
  isNullAccessResult(value) || isPropertyNotFoundResult(value);

/** Extracts the originating object's display name from a null-access sentinel. */
export const getNullParentName = (value: unknown): string | null => {
  if (!isNullAccessResult(value)) {
    return null;
  }
  return value.__nunjucks_parent__ ?? null;
};

/**
 * Reads a member for optional-chaining sites, collapsing both miss sentinels
 * to a plain `undefined` so `obj?.missing` short-circuits cleanly.
 */
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

/**
 * Slices arrays or strings with Python-style `start`/`stop`/`step` bounds,
 * normalizing negative indices and throwing on `step: 0`.
 */
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
  const normalizedStart = normalizeIndex({
    index: start,
    length: len,
    defaultValue: 0,
    step: stepValue,
  });
  const normalizedStop = normalizeIndex({
    index: stop,
    length: len,
    defaultValue: stepValue < 0 ? -1 : len,
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
