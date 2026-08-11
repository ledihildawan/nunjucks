import { describe, expect, test } from 'bun:test';
import { runFilter } from './filter-runtime.ts';

type ResolvedFilter = (...args: unknown[]) => unknown;
type GetFilter = (name: string, lineno: number, colno: number) => ResolvedFilter;

const createValidFilterEnv = (resolveFilter: GetFilter): { getFilter: GetFilter } => ({
  getFilter: resolveFilter,
});

describe('runFilter', () => {
  describe('happy path', () => {
    test('returns the value of a synchronous filter', async () => {
      const uppercaseFilter = (...args: unknown[]): unknown => String(args[0]).toUpperCase();
      const validEnv = createValidFilterEnv(() => uppercaseFilter);

      const result = await runFilter(validEnv, 'upper', 1, 2, null, 'hello');

      expect(result).toBe('HELLO');
    });

    test('awaits the value of a promise-returning filter', async () => {
      const asyncEchoFilter = (...args: unknown[]): unknown =>
        Promise.resolve(`async:${String(args[0])}`);
      const validEnv = createValidFilterEnv(() => asyncEchoFilter);

      const result = await runFilter(validEnv, 'asyncEcho', 10, 20, null, 'payload');

      expect(result).toBe('async:payload');
    });

    test('binds the render context as `this` inside the filter', async () => {
      const prefixedFilter = function (this: { prefix: string }, ...args: unknown[]): unknown {
        return `${this.prefix}:${String(args[0])}`;
      };
      const renderContext = { prefix: 'ctx' };
      const validEnv = createValidFilterEnv(() => prefixedFilter);

      const result = await runFilter(validEnv, 'prefixed', 1, 1, renderContext, 'value');

      expect(result).toBe('ctx:value');
    });

    test('forwards trailing positional args to the filter', async () => {
      const sumFilter = (...args: unknown[]): unknown =>
        args.reduce<number>((total, value) => total + Number(value), 0);
      const validEnv = createValidFilterEnv(() => sumFilter);

      const result = await runFilter(validEnv, 'sum', 1, 1, null, 1, 2, 3, 4);

      expect(result).toBe(10);
    });

    test('passes name, lineno, and colno through to getFilter', async () => {
      const getFilterInvocations: Array<{ name: string; lineno: number; colno: number }> = [];
      const validEnv = createValidFilterEnv((name, lineno, colno) => {
        getFilterInvocations.push({ name, lineno, colno });
        return (): unknown => 'resolved';
      });

      await runFilter(validEnv, 'tracked', 7, 9, null);

      expect(getFilterInvocations).toEqual([{ name: 'tracked', lineno: 7, colno: 9 }]);
    });
  });

  describe('error propagation', () => {
    test('propagates the original error thrown synchronously by the filter', async () => {
      const filterError = new RangeError('bad input');
      const throwingFilter = (): unknown => {
        throw filterError;
      };
      const validEnv = createValidFilterEnv(() => throwingFilter);

      await expect(runFilter(validEnv, 'boom', 1, 1, null)).rejects.toBe(filterError);
    });

    test('propagates the rejection of a promise-returning filter', async () => {
      const rejectionError = new TypeError('async failure');
      const rejectingFilter = (): unknown => Promise.reject(rejectionError);
      const validEnv = createValidFilterEnv(() => rejectingFilter);

      await expect(runFilter(validEnv, 'rej', 1, 1, null)).rejects.toBe(rejectionError);
    });

    test('propagates the error when getFilter cannot resolve the filter name', async () => {
      const notFoundError = new Error('filter not found: missing');
      const validEnv = createValidFilterEnv(() => {
        throw notFoundError;
      });

      await expect(runFilter(validEnv, 'missing', 3, 5, null)).rejects.toBe(notFoundError);
    });
  });

  // Exercises the module-private isFilterEnv guard through the public runFilter surface.
  describe('environment validation (isFilterEnv guard)', () => {
    type InvalidEnvCase = { label: string; env: unknown };
    const invalidEnvs: readonly InvalidEnvCase[] = [
      { label: 'null', env: null },
      { label: 'undefined', env: undefined },
      { label: 'an object missing getFilter', env: {} },
      { label: 'a non-function getFilter', env: { getFilter: 'nope' } },
      { label: 'a number primitive', env: 42 },
      { label: 'a string primitive', env: 'env' },
    ];

    invalidEnvs.forEach(({ label, env }) => {
      test(`rejects with a TypeError for ${label}`, async () => {
        await expect(runFilter(env, 'upper', 1, 1, null)).rejects.toBeInstanceOf(TypeError);
      });
    });

    test('rejection message names the required getFilter contract', async () => {
      const nullEnv = null;

      await expect(runFilter(nullEnv, 'upper', 1, 1, null)).rejects.toThrow(
        'getFilter(name, lineno, colno)',
      );
    });

    test('accepts a valid env and never reaches the guard throw', async () => {
      const validEnv = createValidFilterEnv(() => (): unknown => 'value');

      const result = await runFilter(validEnv, 'ok', 1, 1, null);

      expect(result).toBe('value');
    });
  });
});
