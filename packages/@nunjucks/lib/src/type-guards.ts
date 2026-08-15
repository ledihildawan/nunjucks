const hasOwn = <O extends object, K extends PropertyKey>(
  value: O,
  key: K
): value is O & Record<K, unknown> => Object.hasOwn(value, key);

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isKeyedObject = (value: unknown): value is Record<PropertyKey, unknown> =>
  value !== null && typeof value === 'object';

const isIterable = (value: unknown): value is Iterable<unknown> =>
  value != null && typeof value === 'object' && Symbol.iterator in value;

const isThenable = (value: unknown): value is Promise<unknown> =>
  isKeyedObject(value) && typeof value.then === 'function';

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

const isResultLike = (value: unknown): value is { ok: boolean } =>
  isKeyedObject(value) && typeof value.ok === 'boolean';

export { isArray, isFunction, isNonNullish, isPlainObject, isString } from 'remeda';
export {
  hasOwn,
  isIterable,
  isKeyedObject,
  isObject,
  isResultLike,
  isThenable,
  isTypedArray,
  readNumber,
  readObject,
  readString,
};
