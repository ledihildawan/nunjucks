import {
  isArray as remedaIsArray,
  isFunction as remedaIsFunction,
  isNonNullish as remedaIsNonNullish,
  isPlainObject as remedaIsPlainObject,
  isString as remedaIsString,
} from 'remeda';

/**
 * Type guard proving `value` owns `key` as a direct property. Built on
 * `Object.hasOwn`, so inherited and prototype-poisoned keys (`__proto__`,
 * `constructor`) never pass.
 */
const hasOwn = <O extends object, K extends PropertyKey>(
  value: O,
  key: K
): value is O & Record<K, unknown> => Object.hasOwn(value, key);

/**
 * Type guard narrowing to a plain string-keyed object: excludes `null`,
 * arrays, and every non-object. Use `isKeyedObject` when arrays should pass.
 */
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Type guard narrowing to any non-null object with arbitrary property keys (arrays included). */
const isKeyedObject = (value: unknown): value is Record<PropertyKey, unknown> =>
  value !== null && typeof value === 'object';

/**
 * Type guard narrowing to values exposing `Symbol.iterator`. Primitives
 * (including strings) fail the object check, so only iterable objects pass.
 */
const isIterable = (value: unknown): value is Iterable<unknown> =>
  value != null && typeof value === 'object' && Symbol.iterator in value;

/**
 * Type guard narrowing to thenables — anything with a callable `then`.
 * Deliberately wider than `instanceof Promise` to cover polyfills and
 * hand-rolled conforming objects.
 */
const isThenable = (value: unknown): value is Promise<unknown> =>
  isKeyedObject(value) && typeof value.then === 'function';

/**
 * Narrows `unknown` input to a string-keyed record without a boolean guard:
 * non-objects degrade to an empty object rather than failing, so callers can
 * keep indexing after crossing an untyped boundary.
 */
const readObject = (value: unknown): Record<string, unknown> => {
  if (isObject(value)) {
    return value;
  }
  return {};
};

/** Reads an optional string field: returns the value when it is a string, else `null`. */
const readString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  return null;
};

/**
 * Reads an optional integer field: returns the value only when it is a
 * number holding an integer, else `null`. Non-integer numbers are rejected.
 */
const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  return null;
};

/** Type guard recognizing every typed-array kind (`Uint8Array` through `BigUint64Array`). */
const isTypedArray = (value: unknown): boolean =>
  value instanceof Int8Array ||
  value instanceof Uint8Array ||
  value instanceof Uint8ClampedArray ||
  value instanceof Int16Array ||
  value instanceof Uint16Array ||
  value instanceof Int32Array ||
  value instanceof Uint32Array ||
  value instanceof Float32Array ||
  value instanceof Float64Array ||
  value instanceof BigInt64Array ||
  value instanceof BigUint64Array;

/**
 * Type guard for result-shaped objects: any non-null object whose `ok` field
 * is a boolean. Used before trusting a value as a `Result` from another
 * package; shape compatibility, not brand identity.
 */
const isResultLike = (value: unknown): value is { ok: boolean } =>
  isKeyedObject(value) && typeof value.ok === 'boolean';

// WHY: remeda's guards are bound one-per-statement so each public name carries its
// contract here — remeda's own types are the implementation, this file is the documented
// API. A per-name `export { x } from 'remeda'` run cannot be used: organizeImports merges
// consecutive same-source exports, which would stack the doc comments so only the last binds.

/** Type guard narrowing to arrays: passes only genuine `Array` values (remeda `isArray`). */
const isArray = remedaIsArray;

/** Type guard narrowing to callables: plain, async, generator, and bound functions pass (remeda `isFunction`). */
const isFunction = remedaIsFunction;

/** Type guard excluding both nullish values: everything else — including `false`/`0`/`''` — passes (remeda `isNonNullish`). */
const isNonNullish = remedaIsNonNullish;

/** Type guard narrowing to literal-created objects: own prototype is `Object.prototype` or `null` (remeda `isPlainObject`). */
const isPlainObject = remedaIsPlainObject;

/** Type guard narrowing to primitive strings: boxed `String` objects fail (remeda `isString`). */
const isString = remedaIsString;

export {
  hasOwn,
  isArray,
  isFunction,
  isIterable,
  isKeyedObject,
  isNonNullish,
  isObject,
  isPlainObject,
  isResultLike,
  isString,
  isThenable,
  isTypedArray,
  readNumber,
  readObject,
  readString,
};
