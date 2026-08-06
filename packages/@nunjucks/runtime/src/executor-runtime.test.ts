import { describe, expect, test } from 'bun:test';
import { isNullAccessResult, isPropertyNotFoundResult } from '@nunjucks/runtime';
import { buildSandboxedRuntime, buildSandboxOptions } from './executor-runtime.ts';

// Regression guard for the sandboxed optional-access bug: optionalMemberLookup
// must short-circuit to `undefined` (mirroring the non-sandboxed variant), not
// leak the internal null/property-not-found markers that memberLookup uses for
// error reporting.
describe('buildSandboxedRuntime', () => {
  const makeRuntime = (): Record<string, unknown> => {
    const base: Record<string, unknown> = {};
    return buildSandboxedRuntime(base, buildSandboxOptions({}));
  };

  test('optionalMemberLookup returns undefined for null/undefined target', () => {
    const runtime = makeRuntime();
    const optional = runtime.optionalMemberLookup as (obj: unknown, val: string) => unknown;

    expect(optional(null, 'key')).toBeUndefined();
    expect(optional(undefined, 'key')).toBeUndefined();
  });

  test('optionalMemberLookup returns undefined for missing property', () => {
    const runtime = makeRuntime();
    const optional = runtime.optionalMemberLookup as (obj: unknown, val: string) => unknown;

    expect(optional({ a: 1 }, 'missing')).toBeUndefined();
  });

  test('optionalMemberLookup returns the value when present', () => {
    const runtime = makeRuntime();
    const optional = runtime.optionalMemberLookup as (obj: unknown, val: string) => unknown;

    expect(optional({ a: 1 }, 'a')).toBe(1);
  });

  test('optionalMemberLookup never leaks the internal markers', () => {
    const runtime = makeRuntime();
    const optional = runtime.optionalMemberLookup as (obj: unknown, val: string) => unknown;

    expect(isNullAccessResult(optional(null, 'key'))).toBe(false);
    expect(isPropertyNotFoundResult(optional({ a: 1 }, 'missing'))).toBe(false);
  });

  test('memberLookup still returns the null marker (error-reporting path intact)', () => {
    const runtime = makeRuntime();
    const lookup = runtime.memberLookup as (obj: unknown, val: string) => unknown;

    expect(isNullAccessResult(lookup(null, 'key'))).toBe(true);
  });
});
