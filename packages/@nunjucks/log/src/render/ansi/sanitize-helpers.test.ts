import { describe, test, expect } from 'bun:test';
import { sanitizePrimitive, sanitizeForAnsi } from './sanitize-helpers.ts';

describe('sanitizePrimitive', () => {
  test('null', () => {
    expect(sanitizePrimitive(null)).toBe('null');
  });

  test('undefined', () => {
    expect(sanitizePrimitive(undefined)).toBe('undefined');
  });

  test('named function', () => {
    expect(sanitizePrimitive(function myFn() {})).toBe('[Function: myFn]');
  });

  test('anonymous function', () => {
    expect(sanitizePrimitive(() => {})).toBe('[Function: anonymous]');
  });

  test('string', () => {
    expect(sanitizePrimitive('hi')).toBe('"hi"');
  });

  test('number', () => {
    expect(sanitizePrimitive(42)).toBe('42');
  });
});

describe('sanitizeForAnsi', () => {
  test('primitive passthrough', () => {
    expect(sanitizeForAnsi('x')).toBe('"x"');
  });

  test('null is not treated as object', () => {
    expect(sanitizeForAnsi(null)).toBe('null');
  });

  test('array', () => {
    expect(sanitizeForAnsi([1, 2, 3])).toBe('Array(3)');
  });

  test('object', () => {
    expect(sanitizeForAnsi({ a: 1, b: 2 })).toBe('Object(2)');
  });

  test('circular reference', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(sanitizeForAnsi(obj)).toBe('Object(1)');
  });
});
