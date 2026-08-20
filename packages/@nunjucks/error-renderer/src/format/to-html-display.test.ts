import { describe, expect, test } from 'bun:test';
import { classifyAndBuildTitle } from '@nunjucks/error-catalog';
import { renderBadge } from './to-html-display.ts';

describe('renderBadge', () => {
  test('returns empty string for null text', () => {
    expect(renderBadge('error', null)).toBe('');
  });

  test('returns empty string for undefined text', () => {
    expect(renderBadge('error', undefined)).toBe('');
  });

  test('returns empty string for empty text', () => {
    expect(renderBadge('error', '')).toBe('');
  });

  test('produces a span with badge class', () => {
    const r = renderBadge('error', 'ERR');
    expect(r).toContain('badge');
    expect(r).toContain('ERR');
  });
});

// WHY: go through the REAL pipeline (classifyAndBuildTitle) — hand-feeding
// uppercase categories to resolveHumanTitle masked the dead-switch bug where
// category is always the lowercase def category.
describe('classifyAndBuildTitle', () => {
  test('undefined variable with name', () => {
    expect(
      classifyAndBuildTitle({
        code: 'UNDEFINED_VARIABLE',
        message: "Variable 'foo' is not defined",
      })
    ).toContain('foo');
  });

  test('undefined function', () => {
    expect(classifyAndBuildTitle({ message: "Function 'bar' is not defined" })).toContain('bar');
  });

  test('fallback for unknown error', () => {
    expect(classifyAndBuildTitle({ message: 'My Error' })).toBe('My Error');
  });
});
