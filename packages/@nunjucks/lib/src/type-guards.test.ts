import { describe, expect, test } from 'bun:test';
import {
  hasOwn,
  isArray,
  isFunction,
  isIterable,
  isKeyedObject,
  isNonNullish,
  isObject,
  isPlainObject,
  isString,
  isThenable,
  isTypedArray,
  readNumber,
  readObject,
  readString,
} from './type-guards.ts';

describe('hasOwn', () => {
  test('narrows to the key when present', () => {
    const obj = { a: 1 } as object;
    if (hasOwn(obj, 'a')) {
      expect(obj.a).toBe(1);
    } else {
      throw new Error('expected hasOwn true');
    }
  });

  test('returns false for missing or inherited keys', () => {
    expect(hasOwn({ a: 1 }, 'b')).toBe(false);
    expect(hasOwn(Object.create({ inherited: 1 }), 'inherited')).toBe(false);
  });
});

describe('isObject', () => {
  test('true for plain objects, false for null/arrays/primitives', () => {
    expect(isObject({})).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject('s')).toBe(false);
    expect(isObject(42)).toBe(false);
  });
});

describe('isKeyedObject', () => {
  test('accepts objects and arrays, rejects null and primitives', () => {
    expect(isKeyedObject({})).toBe(true);
    expect(isKeyedObject([])).toBe(true);
    expect(isKeyedObject(null)).toBe(false);
    expect(isKeyedObject('s')).toBe(false);
  });
});

describe('isIterable', () => {
  test('true for arrays and sets, false for plain objects and primitives', () => {
    expect(isIterable([1, 2])).toBe(true);
    expect(isIterable(new Set([1]))).toBe(true);
    expect(isIterable({})).toBe(false);
    expect(isIterable(42)).toBe(false);
    expect(isIterable(null)).toBe(false);
  });
});

describe('isThenable', () => {
  test('true for Promise-like objects, false for plain values', () => {
    expect(isThenable(Promise.resolve(1))).toBe(true);
    // biome-ignore lint/suspicious/noThenProperty: intentionally a thenable to exercise the guard
    expect(isThenable({ then: () => undefined })).toBe(true);
    expect(isThenable({})).toBe(false);
    expect(isThenable(null)).toBe(false);
    expect(isThenable(42)).toBe(false);
  });
});

describe('readers', () => {
  test('readObject returns the object or empty fallback', () => {
    expect(readObject({ a: 1 })).toEqual({ a: 1 });
    expect(readObject(null)).toEqual({});
    expect(readObject('s')).toEqual({});
  });

  test('readString returns the string or null', () => {
    expect(readString('hi')).toBe('hi');
    expect(readString(42)).toBeNull();
    expect(readString(null)).toBeNull();
  });

  test('readNumber returns integers only', () => {
    expect(readNumber(3)).toBe(3);
    expect(readNumber(3.5)).toBeNull();
    expect(readNumber('3')).toBeNull();
    expect(readNumber(null)).toBeNull();
  });
});

describe('isTypedArray', () => {
  test('true for every typed array flavor', () => {
    expect(isTypedArray(new Int8Array(1))).toBe(true);
    expect(isTypedArray(new Uint8Array(1))).toBe(true);
    expect(isTypedArray(new Uint8ClampedArray(1))).toBe(true);
    expect(isTypedArray(new Int16Array(1))).toBe(true);
    expect(isTypedArray(new Uint16Array(1))).toBe(true);
    expect(isTypedArray(new Int32Array(1))).toBe(true);
    expect(isTypedArray(new Uint32Array(1))).toBe(true);
    expect(isTypedArray(new Float32Array(1))).toBe(true);
    expect(isTypedArray(new Float64Array(1))).toBe(true);
    expect(isTypedArray(new BigInt64Array(1))).toBe(true);
    expect(isTypedArray(new BigUint64Array(1))).toBe(true);
  });

  test('false for plain arrays and primitives', () => {
    expect(isTypedArray([1, 2])).toBe(false);
    expect(isTypedArray('s')).toBe(false);
    expect(isTypedArray(null)).toBe(false);
  });
});

describe('remeda re-exports', () => {
  test('are available as guards', () => {
    expect(isNonNullish(1)).toBe(true);
    expect(isNonNullish(null)).toBe(false);
    expect(isFunction(() => 1)).toBe(true);
    expect(isString('s')).toBe(true);
    expect(isArray([])).toBe(true);
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(false);
  });
});
