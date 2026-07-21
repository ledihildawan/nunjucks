import { describe, test, expect } from 'bun:test';
import { createObj, isObj } from './object.ts';

describe('createObj', () => {
  test('creates an object with init', () => {
    const obj = createObj({
      name: 'Test',
      init: function (this: Record<string, unknown>) { this.value = 42; },
      getValue: function (this: Record<string, unknown>) { return this.value; },
    });
    (obj.init as () => void)();
    expect((obj.getValue as () => unknown)()).toBe(42);
  });

  test('isObj recognizes createObj result', () => {
    const obj = createObj({});
    expect(isObj(obj)).toBe(true);
  });

  test('isObj rejects plain objects', () => {
    expect(isObj({})).toBe(false);
    expect(isObj(null)).toBe(false);
    expect(isObj(undefined)).toBe(false);
    expect(isObj('string')).toBe(false);
  });

  test('default init is a no-op', () => {
    const obj = createObj({});
    expect(typeof obj.init).toBe('function');
    expect(() => (obj.init as () => void)()).not.toThrow();
  });

  test('stores function props as first-class values (no wrapping)', () => {
    const fn = (x: number) => x + 1;
    const obj = createObj({ add: fn });
    expect(obj.add).toBe(fn);
    expect((obj.add as (x: number) => number)(1)).toBe(2);
  });
});
