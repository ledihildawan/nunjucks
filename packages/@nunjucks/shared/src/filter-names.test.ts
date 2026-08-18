import { describe, expect, test } from 'bun:test';
import { BUILTIN_FILTER_NAMES } from './filter-names.ts';

// WHY: cross-registry drift is pinned by filters/src/filter-names.test.ts — these tests pin
// the invariants of the shared SSOT list itself, independent of the filters barrel.
describe('BUILTIN_FILTER_NAMES', () => {
  test('is frozen against mutation', () => {
    expect(Object.isFrozen(BUILTIN_FILTER_NAMES)).toBe(true);
    expect(() => {
      (BUILTIN_FILTER_NAMES as string[]).push('rogueFilter');
    }).toThrow(TypeError);
    expect(BUILTIN_FILTER_NAMES).not.toContain('rogueFilter');
  });

  test('contains no duplicate names', () => {
    expect(new Set(BUILTIN_FILTER_NAMES).size).toBe(BUILTIN_FILTER_NAMES.length);
  });

  test('every name is a non-empty callable identifier', () => {
    for (const name of BUILTIN_FILTER_NAMES) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
      expect(name).toMatch(/^[a-zA-Z_$][\w$]*$/);
    }
  });

  test('registers the core built-in filters', () => {
    for (const name of [
      'first',
      'groupby',
      'escape',
      'join',
      'sort',
      'truncate',
      'urlencode',
      'default',
    ]) {
      expect(BUILTIN_FILTER_NAMES).toContain(name);
    }
  });

  test('registers the upstream-compat aliases', () => {
    for (const name of ['d', 'e', 'length']) {
      expect(BUILTIN_FILTER_NAMES).toContain(name);
    }
  });

  test('deliberately omits sanitize so the name stays free for hosts', () => {
    expect(BUILTIN_FILTER_NAMES).not.toContain('sanitize');
  });
});
