const hasOwn = <O extends object, K extends PropertyKey>(
  obj: O,
  key: K
): obj is O & Record<K, unknown> => Object.hasOwn(obj, key);

const isObject = (val: unknown): val is Record<string, unknown> =>
  val !== null && typeof val === 'object' && !Array.isArray(val);

const isRecord = (val: unknown): val is Record<string, unknown> =>
  isObject(val);

const isKeyedObject = (val: unknown): val is Record<PropertyKey, unknown> =>
  val !== null && typeof val === 'object';

const isIterable = (val: unknown): val is Iterable<unknown> =>
  val != null && typeof val === 'object' && Symbol.iterator in val;

const isThenable = (val: unknown): val is Promise<unknown> =>
  isKeyedObject(val) && typeof val.then === 'function';

const isArrayOf = <T>(guard: (x: unknown) => x is T) => (arr: unknown): arr is T[] =>
  Array.isArray(arr) && arr.every(guard);

const readObject = (value: unknown): Record<string, unknown> => {
  if (isObject(value)) {
    return value;
  }
  return {};
};

const readString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  return null;
};

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  return null;
};

const readWith = <T>(value: unknown, guard: (x: unknown) => x is T, fallback: T): T =>
  guard(value) ? value : fallback;

export {
  hasOwn,
  isObject,
  isRecord,
  isKeyedObject,
  isIterable,
  isThenable,
  isArrayOf,
  readObject,
  readString,
  readNumber,
  readWith,
};

export { isNonNullish, isFunction, isString, isArray, isPlainObject } from 'remeda';
