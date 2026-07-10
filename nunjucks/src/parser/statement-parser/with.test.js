import { describe, test, expect } from 'bun:test';
import { parseWithContext } from './with.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseWithContext', () => {
  test('returns null when no with/without token', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'something', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(parseWithContext(ctx)).toBeNull();
  });

  test('returns true for with context', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'with', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'context', lineno: 1, colno: 6 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);

    expect(parseWithContext(ctx)).toBe(true);
  });

  test('returns false for without context', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'without', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'context', lineno: 1, colno: 9 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);

    expect(parseWithContext(ctx)).toBe(false);
  });

  test('throws when with is not followed by context', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'with', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'something', lineno: 1, colno: 6 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);

    expect(() => parseWithContext(ctx)).toThrow('expected context');
  });

  test('throws when without is not followed by context', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'without', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'else', lineno: 1, colno: 9 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);

    expect(() => parseWithContext(ctx)).toThrow('expected context');
  });
});
