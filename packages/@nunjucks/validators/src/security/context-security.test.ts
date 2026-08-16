import { describe, expect, test } from 'bun:test';
import { findDangerousValues } from './context-security.ts';

describe('context-security', () => {
  describe('findDangerousValues', () => {
    test('returns empty array for safe context', () => {
      const context = { name: 'Ada', age: 42 };
      expect(findDangerousValues(context)).toEqual([]);
    });

    test('finds dangerous top-level keys', () => {
      const context = { name: 'Ada', process: process as unknown };
      const result = findDangerousValues(context);
      expect(result).toContain('process');
    });

    test('finds dangerous nested keys', () => {
      const context = {
        user: {
          process: process as unknown,
        },
      };
      const result = findDangerousValues(context);
      expect(result).toContain('user.process');
    });

    test('finds dangerous eval function at top level', () => {
      const context = {
        // biome-ignore lint/security/noGlobalEval: testing dangerous function detection
        myFunc: eval,
      };
      const result = findDangerousValues(context);
      expect(result).toContain('myFunc');
    });

    test('finds dangerous Function constructor at top level', () => {
      const context = {
        myFunc: Function,
      };
      const result = findDangerousValues(context);
      expect(result).toContain('myFunc');
    });

    test('ignores functions at nested levels', () => {
      const context = {
        outer: {
          // biome-ignore lint/security/noGlobalEval: testing nested function handling
          innerFn: eval,
        },
      };
      const result = findDangerousValues(context);
      expect(result).not.toContain('outer.innerFn');
    });

    test('ignores allowed functions when in allowedGlobals', () => {
      const safeFunction = () => {};
      const context = { safeFn: safeFunction };
      expect(findDangerousValues(context, ['safeFn'])).toEqual([]);
    });

    test('finds dangerous references within objects', () => {
      const context = {
        window: globalThis,
      };
      const result = findDangerousValues(context);
      expect(result).toContain('window');
    });

    test('finds multiple dangerous values', () => {
      const context = {
        process: process as unknown,
        window: globalThis,
        // biome-ignore lint/security/noGlobalEval: testing multiple dangerous value detection
        eval: eval,
      };
      const result = findDangerousValues(context);
      expect(result).toContain('process');
      expect(result).toContain('window');
      expect(result).toContain('eval');
    });

    test('handles deeply nested dangerous values', () => {
      const context = {
        level1: {
          level2: {
            level3: {
              process: process as unknown,
            },
          },
        },
      };
      const result = findDangerousValues(context);
      expect(result).toContain('level1.level2.level3.process');
    });

    test('returns unique paths only', () => {
      const context = {
        a: {
          b: {
            process: process as unknown,
          },
        },
        c: {
          d: {
            process: process as unknown,
          },
        },
      };
      const result = findDangerousValues(context);
      const processPaths = result.filter((p) => p.endsWith('process'));
      expect(processPaths).toHaveLength(2);
    });
  });
});
