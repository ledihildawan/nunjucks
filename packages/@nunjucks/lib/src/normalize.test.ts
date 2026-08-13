import { describe, test, expect } from 'bun:test';
import { normalize } from './normalize.ts';

describe('normalize', () => {
  test('coerces non-nullish values to strings', () => {
    expect(normalize(42, 'fallback')).toBe('42');
    expect(normalize('keep', 'fallback')).toBe('keep');
  });

  test('returns the default for null, undefined and false', () => {
    expect(normalize(null, 'fallback')).toBe('fallback');
    expect(normalize(undefined, 'fallback')).toBe('fallback');
    expect(normalize(false, 'fallback')).toBe('fallback');
  });
});
