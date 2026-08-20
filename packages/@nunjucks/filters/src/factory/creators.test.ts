import { describe, expect, test } from 'bun:test';
import { getOrElse } from '@nunjucks/lib';
import { createMacroFilter, createStringFilter } from './creators.ts';
import { isSafeString, safeString } from './helpers.ts';

describe('createStringFilter', () => {
  test('returns a callable function', () => {
    const upper = createStringFilter((s: string): string => s.toUpperCase());
    expect(typeof upper).toBe('function');
  });

  type TransformCase = {
    readonly label: string;
    readonly transform: (s: string) => string;
    readonly input: string;
    readonly expected: string;
  };
  const transformCases: readonly TransformCase[] = [
    {
      label: 'upper-cases lowercase text',
      transform: (s) => s.toUpperCase(),
      input: 'hello',
      expected: 'HELLO',
    },
    {
      label: 'trims surrounding whitespace',
      transform: (s) => s.trim(),
      input: '  hi  ',
      expected: 'hi',
    },
    {
      label: 'reverses characters',
      transform: (s) => s.split('').reverse().join(''),
      input: 'abc',
      expected: 'cba',
    },
    {
      label: 'leaves an empty string untouched',
      transform: (s) => s.toUpperCase(),
      input: '',
      expected: '',
    },
  ];

  transformCases.forEach(({ label, transform, input, expected }) => {
    test(`applies a transformation that ${label}`, () => {
      const filter = createStringFilter(transform);
      expect(getOrElse(filter(input), null)).toBe(expected);
    });
  });

  type CoerceCase = { readonly label: string; readonly input: unknown; readonly expected: string };
  const coerceCases: readonly CoerceCase[] = [
    { label: 'a positive number coerced then transformed', input: 42, expected: '42' },
    { label: 'zero coerced then transformed', input: 0, expected: '0' },
    { label: 'true coerced then transformed', input: true, expected: 'TRUE' },
    {
      label: 'a plain object stringified then transformed',
      input: { key: 'value' },
      expected: '[OBJECT OBJECT]',
    },
    { label: 'an array stringified then transformed', input: [1, 2, 3], expected: '1,2,3' },
  ];

  const upper = createStringFilter((s: string): string => s.toUpperCase());
  coerceCases.forEach(({ label, input, expected }) => {
    test(`coerces ${label}`, () => {
      expect(getOrElse(upper(input), null)).toBe(expected);
    });
  });

  test('normalizes nullish and false inputs to the empty string before transforming', () => {
    expect(getOrElse(upper(null), null)).toBe('');
    expect(getOrElse(upper(undefined), null)).toBe('');
    expect(getOrElse(upper(false), null)).toBe('');
  });

  test('returns a plain (non-safe) string when the input is a plain string', () => {
    const identity = createStringFilter((s: string): string => s);
    const result = getOrElse(identity('plain'), null);
    expect(result).toBe('plain');
    expect(isSafeString(result)).toBe(false);
  });

  test('preserves safeness by returning a SafeString when the input is a SafeString', () => {
    const safeInput = safeString('hello');
    // WHY: typed sentinel — the union result admits '', so no non-null-assertion hack.
    const result = getOrElse(upper(safeInput), '');
    expect(isSafeString(result)).toBe(true);
    expect(result.toString()).toBe('HELLO');
  });

  test('does not mark the result safe when the input is nullish', () => {
    const identity = createStringFilter((s: string): string => s);
    expect(isSafeString(getOrElse(identity(null), null))).toBe(false);
    expect(isSafeString(getOrElse(identity(undefined), null))).toBe(false);
  });

  test('does not mark the result safe when the input is a non-safe primitive', () => {
    const identity = createStringFilter((s: string): string => s);
    expect(isSafeString(getOrElse(identity('plain'), null))).toBe(false);
  });
});

describe('createMacroFilter', () => {
  test('returns a callable function', () => {
    const macro = createMacroFilter(['a', 'b'], (a: unknown, b: unknown) => ({ a, b }));
    expect(typeof macro).toBe('function');
  });

  test('passes positional arguments to the wrapped function at exact arity', () => {
    const macro = createMacroFilter(['a', 'b'], (a: unknown, b: unknown) => ({ a, b }));
    expect(macro('x', 'y')).toEqual({ a: 'x', b: 'y' });
  });

  test('fills missing positional arguments from keyword arguments', () => {
    const macro = createMacroFilter(['a', 'b'], (a: unknown, b: unknown) => ({ a, b }));
    const result = macro('x', { keywords: true, b: 'y' });
    expect(result).toEqual({ a: 'x', b: 'y' });
  });

  test('leaves missing positional arguments undefined when absent from keywords', () => {
    const macro = createMacroFilter(['a', 'b'], (a: unknown, b: unknown) => ({ a, b }));
    const result = macro('x', { keywords: true });
    expect(result).toEqual({ a: 'x', b: undefined });
  });

  test('fills every positional argument from keyword arguments when only kwargs are passed', () => {
    const macro = createMacroFilter(['a', 'b'], (a: unknown, b: unknown) => ({ a, b }));
    const result = macro({ keywords: true, a: 'x', b: 'y' });
    expect(result).toEqual({ a: 'x', b: 'y' });
  });

  test('returns the wrapped function return value directly without coercion', () => {
    const macro = createMacroFilter(
      ['value', 'fallback'],
      (value: unknown, fallback: unknown) => value ?? fallback
    );
    expect(macro(null, 'default')).toBe('default');
    expect(macro('present', 'default')).toBe('present');
  });

  test('supports a non-object return value from the wrapped function', () => {
    const macro = createMacroFilter(
      ['a', 'b'],
      (a: unknown, b: unknown) => (a as number) + (b as number)
    );
    expect(macro(2, 3)).toBe(5);
  });
});
