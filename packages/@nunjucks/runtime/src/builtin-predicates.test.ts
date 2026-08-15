import { describe, expect, test } from 'bun:test';
import { runTest } from './builtin-predicates.ts';
import { createSafeString } from './runtime-contract/safe-string.ts';

const T = (name: string, target: unknown, ...args: unknown[]) =>
  runTest(null, name, target, ...args);

describe('builtin tests', () => {
  describe('existence', () => {
    test('defined', () => {
      expect(T('defined', 'x')).toBe(true);
      expect(T('defined', undefined)).toBe(false);
    });
    test('undefined', () => {
      expect(T('undefined', undefined)).toBe(true);
      expect(T('undefined', 'x')).toBe(false);
    });
    test('null', () => {
      expect(T('null', null)).toBe(true);
      expect(T('null', 'x')).toBe(false);
    });
    test('none', () => {
      expect(T('none', null)).toBe(true);
      expect(T('none', undefined)).toBe(true);
      expect(T('none', 0)).toBe(false);
    });
  });

  describe('boolean', () => {
    test('true', () => {
      expect(T('true', true)).toBe(true);
      expect(T('true', 1)).toBe(false);
    });
    test('false', () => {
      expect(T('false', false)).toBe(true);
      expect(T('false', 0)).toBe(false);
    });
    test('boolean', () => {
      expect(T('boolean', true)).toBe(true);
      expect(T('boolean', false)).toBe(true);
      expect(T('boolean', 0)).toBe(false);
    });
  });

  describe('number', () => {
    test('number', () => {
      expect(T('number', 42)).toBe(true);
      expect(T('number', Number.NaN)).toBe(false);
      expect(T('number', '42')).toBe(false);
    });
    test('integer', () => {
      expect(T('integer', 42)).toBe(true);
      expect(T('integer', 3.14)).toBe(false);
    });
    test('float', () => {
      expect(T('float', 3.14)).toBe(true);
      expect(T('float', 42)).toBe(false);
    });
    test('odd', () => {
      expect(T('odd', 3)).toBe(true);
      expect(T('odd', 4)).toBe(false);
    });
    test('even', () => {
      expect(T('even', 4)).toBe(true);
      expect(T('even', 3)).toBe(false);
    });
    test('positive', () => {
      expect(T('positive', 5)).toBe(true);
      expect(T('positive', -5)).toBe(false);
    });
    test('negative', () => {
      expect(T('negative', -5)).toBe(true);
      expect(T('negative', 5)).toBe(false);
    });
    test('zero', () => {
      expect(T('zero', 0)).toBe(true);
      expect(T('zero', 1)).toBe(false);
    });
    test('finite', () => {
      expect(T('finite', 42)).toBe(true);
      expect(T('finite', Number.POSITIVE_INFINITY)).toBe(false);
    });
    test('nan', () => {
      expect(T('nan', Number.NaN)).toBe(true);
      expect(T('nan', 42)).toBe(false);
    });
    test('divisibleby', () => {
      expect(T('divisibleby', 10, 2)).toBe(true);
      expect(T('divisibleby', 10, 3)).toBe(false);
    });
    test('between', () => {
      expect(T('between', 5, 1, 10)).toBe(true);
      expect(T('between', 15, 1, 10)).toBe(false);
    });
  });

  describe('string', () => {
    test('string', () => {
      expect(T('string', 'hi')).toBe(true);
      expect(T('string', 42)).toBe(false);
    });
    test('lower', () => {
      expect(T('lower', 'hello')).toBe(true);
      expect(T('lower', 'Hello')).toBe(false);
    });
    test('upper', () => {
      expect(T('upper', 'HELLO')).toBe(true);
      expect(T('upper', 'Hello')).toBe(false);
    });
    test('alpha', () => {
      expect(T('alpha', 'abc')).toBe(true);
      expect(T('alpha', 'abc1')).toBe(false);
    });
    test('alphanumeric', () => {
      expect(T('alphanumeric', 'abc123')).toBe(true);
      expect(T('alphanumeric', 'abc!')).toBe(false);
    });
    test('numeric', () => {
      expect(T('numeric', '123')).toBe(true);
      expect(T('numeric', '12a')).toBe(false);
    });
    test('startswith', () => {
      expect(T('startswith', 'hello', 'he')).toBe(true);
      expect(T('startswith', 'hello', 'x')).toBe(false);
    });
    test('endswith', () => {
      expect(T('endswith', 'hello', 'lo')).toBe(true);
      expect(T('endswith', 'hello', 'x')).toBe(false);
    });
  });

  describe('container', () => {
    test('empty', () => {
      expect(T('empty', '')).toBe(true);
      expect(T('empty', [])).toBe(true);
      expect(T('empty', 'x')).toBe(false);
    });
    test('blank', () => {
      expect(T('blank', '  ')).toBe(true);
      expect(T('blank', 'x')).toBe(false);
    });
    test('contains', () => {
      expect(T('contains', [1, 2], 2)).toBe(true);
      expect(T('contains', [1, 2], 3)).toBe(false);
    });
  });

  describe('type', () => {
    test('array', () => {
      expect(T('array', [1])).toBe(true);
      expect(T('array', 'x')).toBe(false);
    });
    test('object', () => {
      expect(T('object', {})).toBe(true);
      expect(T('object', null)).toBe(false);
      expect(T('object', [1])).toBe(true);
    });
    test('iterable', () => {
      expect(T('iterable', [1])).toBe(true);
      expect(T('iterable', 42)).toBe(false);
    });
    test('Map', () => {
      expect(T('Map', new Map())).toBe(true);
      expect(T('Map', new Set())).toBe(false);
    });
    test('Set', () => {
      expect(T('Set', new Set())).toBe(true);
      expect(T('Set', new Map())).toBe(false);
    });
    test('Date', () => {
      expect(T('Date', new Date())).toBe(true);
      expect(T('Date', 'x')).toBe(false);
    });
    test('none (null or undefined)', () => {
      expect(T('none', null)).toBe(true);
      expect(T('none', undefined)).toBe(true);
      expect(T('none', 0)).toBe(false);
    });
  });

  describe('comparison', () => {
    test('sameas', () => {
      const o = {};
      expect(T('sameas', o, o)).toBe(true);
      expect(T('sameas', o, {})).toBe(false);
    });
    test('equalto', () => {
      expect(T('equalto', { a: 1 }, { a: 1 })).toBe(true);
      expect(T('equalto', { a: 1 }, { a: 2 })).toBe(false);
    });
  });

  describe('SafeString', () => {
    test('safe', () => {
      expect(T('safe', createSafeString('hi'))).toBe(true);
      expect(T('safe', 'hi')).toBe(false);
    });
    test('escaped', () => {
      expect(T('escaped', 'hi')).toBe(true);
      expect(T('escaped', createSafeString('hi'))).toBe(false);
    });
  });

  test('unknown test returns false', () => {
    expect(T('nonexistent', 'x')).toBe(false);
  });
});
