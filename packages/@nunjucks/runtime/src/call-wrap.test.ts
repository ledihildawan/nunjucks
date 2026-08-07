import { describe, test, expect } from 'bun:test';
import { callWrap, inOperator } from './call-wrap.ts';

describe('callWrap', () => {
  test('invokes function bound to context with args', () => {
    const fn = function (this: { prefix: string }, a: string, b: string) {
      return this.prefix + a + b;
    };
    expect(callWrap(fn, 'test', 'test()', { prefix: 'r:' }, ['x', 'y'])).toBe('r:xy');
  });

  test('allows slot keyword', () => {
    const fn = () => 'result';
    expect(callWrap(fn, 'slot', 'slot()', {}, [])).toBe('result');
  });

  test('throws RESERVED_KEYWORD_CONTEXT for "super"', () => {
    expect(() => callWrap(() => 1, 'super', 'super()', {}, [])).toThrow('reserved keyword');
  });

  test('throws NULL_VALUE for null/undefined obj', () => {
    expect(() => callWrap(null, 'foo', 'foo()', {}, [], 1, 2)).toThrow("Cannot access 'foo' on null");
    try {
      callWrap(undefined, 'foo', 'foo()', {}, [], 1, 2);
    } catch (e) {
      expect((e as { code: string }).code).toBe('NULL_VALUE');
    }
  });

  test('throws NOT_A_FUNCTION for non-function obj', () => {
    expect(() => callWrap(42, 'bar', 'bar()', {}, [], 1, 2)).toThrow('not a function');
    try {
      callWrap('nope', 'bar', 'bar()', {}, [], 1, 2);
    } catch (e) {
      expect((e as { code: string }).code).toBe('NOT_A_FUNCTION');
    }
  });

  test('uses displayName in NOT_A_FUNCTION error', () => {
    expect(() => callWrap(42, 'internal', 'prettyName()', {}, [], 1, 2)).toThrow("'prettyName()'");
  });
});

describe('inOperator', () => {
  test('checks array membership', () => {
    expect(inOperator(2, [1, 2, 3])).toBe(true);
    expect(inOperator(4, [1, 2, 3])).toBe(false);
  });

  test('checks string membership', () => {
    expect(inOperator('o', 'hello')).toBe(true);
    expect(inOperator('z', 'hello')).toBe(false);
  });

  test('checks object key presence', () => {
    expect(inOperator('name', { name: 'alice' })).toBe(true);
    expect(inOperator('age', { name: 'alice' })).toBe(false);
  });

  test('throws for unsupported right-hand types', () => {
    expect(() => inOperator('x', 42)).toThrow("Cannot use 'in' operator");
    expect(() => inOperator('x', null)).toThrow();
  });

  test('preserves location info on the thrown error', () => {
    try {
      inOperator('x', 42, 3, 7);
    } catch (e) {
      expect((e as { code: string }).code).toBe('IN_OPERATOR');
      expect((e as { lineno: number }).lineno).toBe(3);
      expect((e as { colno: number }).colno).toBe(7);
      return;
    }
    throw new Error('expected inOperator to throw');
  });
});
