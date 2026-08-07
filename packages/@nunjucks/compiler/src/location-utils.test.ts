import { describe, test, expect } from 'bun:test';
import { extractPropertyLocation } from './location-utils.ts';
import { literal, lookupVal, symbol } from '@nunjucks/nodes';

describe('extractPropertyLocation', () => {
  test('returns null location for null/undefined node', () => {
    expect(extractPropertyLocation(null)).toEqual({ lineno: null, colno: null });
    expect(extractPropertyLocation(undefined)).toEqual({ lineno: null, colno: null });
  });

  test('returns node location for a plain node', () => {
    const node = literal(5, 10, 'x');
    expect(extractPropertyLocation(node)).toEqual({ lineno: 5, colno: 10 });
  });

  test('returns the value child location for a lookupVal node', () => {
    const node = lookupVal(1, 1, symbol(1, 1, 'obj'), literal(3, 7, 'key'));
    expect(extractPropertyLocation(node)).toEqual({ lineno: 3, colno: 7 });
  });

  test('applies the colnoOffset to the value child location', () => {
    const node = lookupVal(1, 1, symbol(1, 1, 'obj'), literal(3, 7, 'key'));
    expect(extractPropertyLocation(node, 2)).toEqual({ lineno: 3, colno: 9 });
  });

  test('falls back to node location when value child has non-integer location', () => {
    const node = lookupVal(5, 9, symbol(5, 9, 'obj'), symbol(Number.NaN as never, Number.NaN as never, 'key') as never);
    expect(extractPropertyLocation(node)).toEqual({ lineno: 5, colno: 9 });
  });
});