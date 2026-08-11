import { describe, test, expect } from 'bun:test';
import { createGensym } from './symbol-generator.ts';

describe('runtime/symbol-generator', () => {
  describe('createGensym', () => {
    test('generates unique symbols with hole prefix', () => {
      const gensym = createGensym('hole');
      const first = gensym();
      const second = gensym();
      expect(first).toMatch(/^hole_\d+$/);
      expect(second).toMatch(/^hole_\d+$/);
      expect(first).not.toBe(second);
    });

    test('generates unique symbols with custom prefix', () => {
      const gensym = createGensym('var');
      expect(gensym()).toBe('var_0');
      expect(gensym()).toBe('var_1');
    });

    test('each call returns incremented counter', () => {
      const gensym = createGensym('x');
      expect(gensym()).toBe('x_0');
      expect(gensym()).toBe('x_1');
      expect(gensym()).toBe('x_2');
    });

    test('separate gensym instances have independent counters', () => {
      const a = createGensym('a');
      const b = createGensym('b');
      expect(a()).toBe('a_0');
      expect(b()).toBe('b_0');
      expect(a()).toBe('a_1');
      expect(b()).toBe('b_1');
    });
  });
});
