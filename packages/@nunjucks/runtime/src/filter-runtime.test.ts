import { describe, expect, test } from 'bun:test';
import { runFilter } from './filter-runtime.ts';
import { isOk, isErr } from '@nunjucks/lib';

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

      const result = await runFilter({ env: validEnv, name: 'upper', lineno: 1, colno: 2, context: null, args: ['hello'] });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) { return; }
      expect(result.value).toBe('HELLO');
    });

    test('awaits the value of a promise-returning filter', async () => {
      const asyncEchoFilter = (...args: unknown[]): unknown =>
        Promise.resolve(`async:${String(args[0])}`);
      const validEnv = createValidFilterEnv(() => asyncEchoFilter);

      const result = await runFilter({ env: validEnv, name: 'asyncEcho', lineno: 10, colno: 20, context: null, args: ['payload'] });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) { return; }
      expect(result.value).toBe('async:payload');
    });

    test('binds the render context as `this` inside the filter', async () => {
      const prefixedFilter = function (this: { prefix: string }, ...args: unknown[]): unknown {
        return `${this.prefix}:${String(args[0])}`;
      };
      const renderContext = { prefix: 'ctx' };
      const validEnv = createValidFilterEnv(() => prefixedFilter);

      const result = await runFilter({ env: validEnv, name: 'prefixed', lineno: 1, colno: 1, context: renderContext, args: ['value'] });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) { return; }
      expect(result.value).toBe('ctx:value');
    });

    test('forwards trailing positional args to the filter', async () => {
      const sumFilter = (...args: unknown[]): unknown =>
        args.reduce<number>((total, value) => total + Number(value), 0);
      const validEnv = createValidFilterEnv(() => sumFilter);

      const result = await runFilter({ env: validEnv, name: 'sum', lineno: 1, colno: 1, context: null, args: [1, 2, 3, 4] });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) { return; }
      expect(result.value).toBe(10);
    });

    test('passes name, lineno, and colno through to getFilter', async () => {
      const getFilterInvocations: Array<{ name: string; lineno: number; colno: number }> = [];
      const validEnv = createValidFilterEnv((name, lineno, colno) => {
        getFilterInvocations.push({ name, lineno, colno });
        return (): unknown => 'resolved';
      });

      await runFilter({ env: validEnv, name: 'tracked', lineno: 7, colno: 9, context: null, args: [] });

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

      const result = await runFilter({ env: validEnv, name: 'boom', lineno: 1, colno: 1, context: null, args: [] });
      expect(isErr(result)).toBe(true);
      if (!isErr(result)) { return; }
      expect(result.error).toBe(filterError);
    });

    test('propagates the rejection of a promise-returning filter', async () => {
      const rejectionError = new TypeError('async failure');
      const rejectingFilter = (): unknown => Promise.reject(rejectionError);
      const validEnv = createValidFilterEnv(() => rejectingFilter);

      const result = await runFilter({ env: validEnv, name: 'rej', lineno: 1, colno: 1, context: null, args: [] });
      expect(isErr(result)).toBe(true);
      if (!isErr(result)) { return; }
      expect(result.error).toBe(rejectionError);
    });

    test('propagates the error when getFilter cannot resolve the filter name', async () => {
      const notFoundError = new Error('filter not found: missing');
      const validEnv = createValidFilterEnv(() => {
        throw notFoundError;
      });

      const result = await runFilter({ env: validEnv, name: 'missing', lineno: 3, colno: 5, context: null, args: [] });
      expect(isErr(result)).toBe(true);
      if (!isErr(result)) { return; }
      expect(result.error).toBe(notFoundError);
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
        const result = await runFilter({ env, name: 'upper', lineno: 1, colno: 1, context: null, args: [] });
        expect(isErr(result)).toBe(true);
        if (!isErr(result)) { return; }
        expect(result.error).toBeInstanceOf(TypeError);
      });
    });

    test('rejection message names the required getFilter contract', async () => {
      const nullEnv = null;

      const result = await runFilter({ env: nullEnv, name: 'upper', lineno: 1, colno: 1, context: null, args: [] });
      expect(isErr(result)).toBe(true);
      if (!isErr(result)) { return; }
      expect((result.error as Error).message).toContain('getFilter(name, lineno, colno)');
    });

    test('accepts a valid env and never reaches the guard throw', async () => {
      const validEnv = createValidFilterEnv(() => (): unknown => 'value');

      const result = await runFilter({ env: validEnv, name: 'ok', lineno: 1, colno: 1, context: null, args: [] });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) { return; }
      expect(result.value).toBe('value');
    });
  });
});
