import { describe, expect, test } from 'bun:test';
import { WARNINGS_CONTEXT_KEY } from './warnings.ts';

describe('WARNINGS_CONTEXT_KEY', () => {
  test('is the stable internal collector key', () => {
    expect(WARNINGS_CONTEXT_KEY).toBe('__warnings__');
  });

  test('is a plain string primitive', () => {
    expect(typeof WARNINGS_CONTEXT_KEY).toBe('string');
  });

  // WHY: this key never crosses a serialization boundary — it must stay distinct from the
  // browser-side `__nunjucks_warnings__` sentinel, which is deliberately different.
  test('does not collide with the browser-side sentinel key', () => {
    expect(WARNINGS_CONTEXT_KEY).not.toContain('__nunjucks_warnings__');
    expect(WARNINGS_CONTEXT_KEY).not.toBe('__nunjucks_warnings__');
  });
});
