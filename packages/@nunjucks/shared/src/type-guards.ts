const hasOwn = <O extends object, K extends PropertyKey>(
  obj: O,
  key: K
): obj is O & Record<K, unknown> => Object.hasOwn(obj, key);

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  isObject(value);

const isKeyedObject = (value: unknown): value is Record<PropertyKey, unknown> =>
  value !== null && typeof value === 'object';

const isIterable = (value: unknown): value is Iterable<unknown> =>
  value != null && typeof value === 'object' && Symbol.iterator in value;

const isThenable = (value: unknown): value is Promise<unknown> =>
  isKeyedObject(value) && typeof value.then === 'function';

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
