import { describe, test, expect } from 'bun:test';
import { getAttrGetter } from './attribute-getter.ts';

describe('getAttrGetter', () => {
  test('descends nested own properties', () => {
    const getter = getAttrGetter('a.b');
    expect(getter({ a: { b: 42 } })).toBe(42);
  });

  test('descends every part of a dotted attribute', () => {
    const getter = getAttrGetter('a.b.c');
    expect(getter({ a: { b: { c: 7 } } })).toBe(7);
  });

  test('returns undefined when a link in the chain is missing', () => {
    const getter = getAttrGetter('a.b.c');
    expect(getter({ a: {} })).toBeUndefined();
  });

  test('resolves numeric parts when present', () => {
    const getter = getAttrGetter('0');
    expect(getter([99, 88])).toBe(99);
  });

  test('treats a numeric attribute as a single part', () => {
    const getter = getAttrGetter(0);
    expect(getter([99, 88])).toBe(99);
  });

  test('never resolves inherited prototype keys', () => {
    expect(getAttrGetter('__proto__')({})).toBeUndefined();
    expect(getAttrGetter('constructor')({})).toBeUndefined();
    expect(getAttrGetter('a.constructor')({ a: {} })).toBeUndefined();
    expect(getAttrGetter('toString')([])).toBeUndefined();
  });

  test('still resolves an own __proto__ defined via defineProperty', () => {
    const item = Object.defineProperty({}, '__proto__', { value: 42, enumerable: true });
    expect(getAttrGetter('__proto__')(item)).toBe(42);
  });
});