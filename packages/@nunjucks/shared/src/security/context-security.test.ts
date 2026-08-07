import { describe, test, expect } from 'bun:test';
import { isDangerousReference, findDangerousValues } from './context-security.ts';
import process from 'node:process';

describe('isDangerousReference', () => {
  test('flags globalThis', () => {
    expect(isDangerousReference(globalThis)).toBe(true);
  });
  test('flags process (Node)', () => {
    expect(isDangerousReference(process)).toBe(true);
  });
  test('does not flag plain object', () => {
    expect(isDangerousReference({})).toBe(false);
  });
  test('does not flag array', () => {
    expect(isDangerousReference([])).toBe(false);
  });
  test('does not flag null/undefined/primitives', () => {
    expect(isDangerousReference(null)).toBe(false);
    expect(isDangerousReference(undefined)).toBe(false);
    expect(isDangerousReference(42)).toBe(false);
    expect(isDangerousReference('str')).toBe(false);
  });
});

describe('findDangerousValues', () => {
  test('returns empty for safe context', () => {
    expect(findDangerousValues({ name: 'alice', age: 30 })).toEqual([]);
  });
  test('flags __proto__ at top level', () => {
    const obj = Object.create(null);
    obj.__proto__ = {};
    expect(findDangerousValues(obj)).toContain('__proto__');
  });
  test('flags constructor at top level', () => {
    expect(findDangerousValues({ constructor: 1 })).toContain('constructor');
  });
  test('flags process at top level', () => {
    expect(findDangerousValues({ process })).toContain('process');
  });
  test('flags process via isDangerousReference at nested level', () => {
    const result = findDangerousValues({ nested: { process } });
    expect(result.length).toBeGreaterThan(0);
  });
  test('flags toString at nested level (object intrinsic)', () => {
    expect(findDangerousValues({ nested: { toString: 'x' } })).toContain('nested.toString');
  });
  test('flags eval at top level (global)', () => {
    expect(findDangerousValues({ eval })).toContain('eval');
  });
  test('flags dangerous reference anywhere', () => {
    expect(findDangerousValues({ root: { ref: globalThis } })).toContain('root.ref');
  });
  test('handles circular references', () => {
    const obj: Record<string, unknown> = { name: 'x' };
    obj.ref = obj;
    expect(findDangerousValues(obj)).toEqual([]);
  });
  test('respects allowedGlobals for builtin functions', () => {
    const myFn = function customFn() { return 1; };
    expect(findDangerousValues({ myFn }, ['customFn'])).toEqual([]);
    expect(findDangerousValues({ myFn }, [])).toContain('myFn');
  });
});
