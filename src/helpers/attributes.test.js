import { expect, describe, test } from 'bun:test';
import { _prepareAttributeParts, getAttrGetter } from './attributes.js';

describe('_prepareAttributeParts', () => {
  test('returns empty array for falsy input', () => {
    expect(_prepareAttributeParts(null)).toEqual([]);
    expect(_prepareAttributeParts(undefined)).toEqual([]);
    expect(_prepareAttributeParts('')).toEqual([]);
  });

  test('splits dot-separated string', () => {
    expect(_prepareAttributeParts('a.b.c')).toEqual(['a', 'b', 'c']);
  });

  test('returns single-element array for string without dots', () => {
    expect(_prepareAttributeParts('foo')).toEqual(['foo']);
  });

  test('wraps non-string value in array', () => {
    expect(_prepareAttributeParts(42)).toEqual([42]);
  });
});

describe('getAttrGetter', () => {
  test('gets simple key from object', () => {
    const getter = getAttrGetter('name');
    expect(getter({ name: 'Alice' })).toBe('Alice');
  });

  test('gets nested key from object', () => {
    const getter = getAttrGetter('user.name');
    expect(getter({ user: { name: 'Bob' } })).toBe('Bob');
  });

  test('returns undefined for missing key', () => {
    const getter = getAttrGetter('missing');
    expect(getter({})).toBeUndefined();
  });

  test('returns undefined for missing nested key', () => {
    const getter = getAttrGetter('a.b.c');
    expect(getter({ a: {} })).toBeUndefined();
  });

  test('works with string key', () => {
    const getter = getAttrGetter('0');
    expect(getter(['x', 'y'])).toBe('x');
  });

  test('falsy numeric key returns item itself (attr is falsy, parts empty)', () => {
    const getter = getAttrGetter(0);
    expect(getter(['x', 'y'])).toEqual(['x', 'y']);
  });

  test('uses hasOwnProperty check', () => {
    const getter = getAttrGetter('toString');
    expect(getter({})).toBeUndefined();
  });
});
