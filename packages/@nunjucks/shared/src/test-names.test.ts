import { describe, expect, test } from 'bun:test';
import { BUILTIN_TEST_NAMES } from './test-names.ts';

describe('BUILTIN_TEST_NAMES', () => {
  test('is frozen against mutation', () => {
    expect(Object.isFrozen(BUILTIN_TEST_NAMES)).toBe(true);
    expect(() => {
      (BUILTIN_TEST_NAMES as string[]).push('rogueTest');
    }).toThrow(TypeError);
    expect(BUILTIN_TEST_NAMES).not.toContain('rogueTest');
  });

  test('contains no duplicate names', () => {
    expect(new Set(BUILTIN_TEST_NAMES).size).toBe(BUILTIN_TEST_NAMES.length);
  });

  // WHY: the lexer tokenizes `x is <name>` keywords against this list — a case-insensitive
  // collision would make one name shadow the other at parse time.
  test('contains no case-insensitive collisions', () => {
    const lowercased = BUILTIN_TEST_NAMES.map((name) => name.toLowerCase());
    expect(new Set(lowercased).size).toBe(BUILTIN_TEST_NAMES.length);
  });

  test('every name is a non-empty identifier', () => {
    for (const name of BUILTIN_TEST_NAMES) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
      expect(name).toMatch(/^[a-zA-Z_$][\w$]*$/);
    }
  });

  test('registers the core value tests', () => {
    for (const name of [
      'even',
      'odd',
      'defined',
      'undefined',
      'divisibleby',
      'sameas',
      'empty',
      'string',
      'number',
    ]) {
      expect(BUILTIN_TEST_NAMES).toContain(name);
    }
  });

  test('registers the capitalized constructor tests unchanged', () => {
    for (const name of ['Date', 'Error', 'Map', 'Promise', 'RegExp', 'Set', 'URL']) {
      expect(BUILTIN_TEST_NAMES).toContain(name);
    }
  });
});
