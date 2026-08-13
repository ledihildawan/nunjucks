import { describe, test, expect } from 'bun:test';
import { loc, ZERO_LOC } from './loc.ts';
import { LOC_BRAND } from '@nunjucks/shared';

describe('loc', () => {
  test('creates a location from non-null lineno and colno', () => {
    const position = loc({ lineno: 3, colno: 7 });

    expect(position.lineno).toBe(3);
    expect(position.colno).toBe(7);
  });

  test('defaults null lineno to zero', () => {
    const position = loc({ lineno: null, colno: 5 });

    expect(position.lineno).toBe(0);
    expect(position.colno).toBe(5);
  });

  test('defaults null colno to zero', () => {
    const position = loc({ lineno: 9, colno: null });

    expect(position.lineno).toBe(9);
    expect(position.colno).toBe(0);
  });

  test('defaults both null fields to zero', () => {
    const position = loc({ lineno: null, colno: null });

    expect(position.lineno).toBe(0);
    expect(position.colno).toBe(0);
  });

  test('stamps the loc brand symbol', () => {
    const position = loc({ lineno: 1, colno: 1 });

    expect(position[LOC_BRAND]).toBe(true);
  });

  test('exposes lineno and colno as readonly numeric fields', () => {
    const position = loc({ lineno: 12, colno: 34 });

    expect(typeof position.lineno).toBe('number');
    expect(typeof position.colno).toBe('number');
  });

  test('preserves explicit zero values from the source', () => {
    const position = loc({ lineno: 0, colno: 0 });

    expect(position.lineno).toBe(0);
    expect(position.colno).toBe(0);
  });

  test('returns a fresh object on each call', () => {
    const firstPosition = loc({ lineno: 2, colno: 4 });
    const secondPosition = loc({ lineno: 2, colno: 4 });

    expect(firstPosition).not.toBe(secondPosition);
    expect(firstPosition).toEqual(secondPosition);
  });
});

describe('ZERO_LOC', () => {
  test('is located at line zero, column zero', () => {
    expect(ZERO_LOC.lineno).toBe(0);
    expect(ZERO_LOC.colno).toBe(0);
  });

  test('carries the loc brand symbol', () => {
    expect(ZERO_LOC[LOC_BRAND]).toBe(true);
  });

  test('matches a freshly created zero location', () => {
    expect(ZERO_LOC).toEqual(loc({ lineno: 0, colno: 0 }));
  });
});

describe('LOC_BRAND', () => {
  test('is a unique symbol', () => {
    expect(typeof LOC_BRAND).toBe('symbol');
  });

  test('is described as Loc', () => {
    expect(LOC_BRAND.description).toBe('Loc');
  });

  test('is not equal to a freshly minted symbol with the same description', () => {
    expect(LOC_BRAND).not.toBe(Symbol('Loc'));
  });
});
