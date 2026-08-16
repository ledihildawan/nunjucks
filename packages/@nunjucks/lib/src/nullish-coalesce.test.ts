import { describe, test, expect } from 'bun:test';
import { nullishCoalesce } from './nullish-coalesce.ts';

describe('nullishCoalesce', () => {
  test('returns the left value when it is defined', () => {
    expect(nullishCoalesce('left', 'right')).toBe('left');
  });

  test('keeps falsy but non-nullish left values', () => {
    expect(nullishCoalesce(0, 7)).toBe(0);
    expect(nullishCoalesce('', 'fallback')).toBe('');
    expect(nullishCoalesce(false, true)).toBe(false);
  });

  test('falls back to the right value on null and undefined', () => {
    expect(nullishCoalesce(null, 'right')).toBe('right');
    expect(nullishCoalesce(undefined, 'right')).toBe('right');
  });

  test('preserves object identity of the kept value', () => {
    const payload = { name: 'nunjucks' };
    expect(nullishCoalesce(payload, null)).toBe(payload);
  });
});
