import { describe, test, expect } from 'bun:test';
import { isScriptPath, renderBadge, resolveHumanTitle } from './to-html-display.ts';

describe('isScriptPath', () => {
  test.each(['file.js', 'file.ts', 'file.jsx', 'file.tsx', 'file.mjs', 'file.cjs'])(
    'returns true for %s',
    (p) => { expect(isScriptPath(p)).toBe(true); },
  );

  test.each(['file.html', 'file.njk', 'file.css', '', null, undefined])(
    'returns false for %s',
    (p) => { expect(isScriptPath(p as never)).toBe(false); },
  );
});

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

describe('resolveHumanTitle', () => {
  test('undefined variable with name', () => {
    expect(resolveHumanTitle({
      category: 'UNDEFINED_VARIABLE',
      undefinedName: 'foo',
      plain: '',
      fallback: 'Error',
    })).toContain('foo');
  });

  test('undefined function', () => {
    expect(resolveHumanTitle({
      category: 'UNDEFINED_FUNCTION',
      undefinedName: 'bar',
      plain: '',
      fallback: 'Error',
    })).toContain('bar');
  });

  test('fallback for unknown category', () => {
    expect(resolveHumanTitle({
      category: 'UNKNOWN',
      undefinedName: null,
      plain: '',
      fallback: 'My Error',
    })).toBe('My Error');
  });
});
