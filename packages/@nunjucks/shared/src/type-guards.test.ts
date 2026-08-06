import { describe, test, expect } from 'bun:test';
import {
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
  isNonNullish,
  isFunction,
  isString,
  isArray,
  isPlainObject,
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

describe('isRecord', () => {
  test('mirrors isObject for record narrowing', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
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

describe('isArrayOf', () => {
  const isStringArray = isArrayOf(isString);
  test('true when every element satisfies the guard', () => {
    expect(isStringArray(['a', 'b'])).toBe(true);
  });
  test('false when any element fails or input is not an array', () => {
    expect(isStringArray(['a', 1])).toBe(false);
    expect(isStringArray('ab')).toBe(false);
    expect(isStringArray([])).toBe(true);
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

describe('readWith', () => {
  test('returns the value when the guard passes', () => {
    expect(readWith('hello', isString, 'fallback')).toBe('hello');
  });

  test('returns the fallback when the guard fails', () => {
    expect(readWith(42, isString, 'fallback')).toBe('fallback');
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
