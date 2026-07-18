import { describe, test, expect } from 'bun:test';
import { error, fail } from './error.js';

describe('error', () => {
  test('creates TemplateError with given message, lineno, colno', () => {
    const err = error(null, 'test error', 5, 10);
    expect(err.message).toContain('test error');
    expect(err.lineno).toBe(5);
    expect(err.colno).toBe(10);
  });

  test('sets phase to parse', () => {
    const err = error(null, 'msg', 1, 2);
    expect(err.phase).toBe('parse');
  });

  test('extracts lineno/colno from token when omitted', () => {
    const ctx = {
      peeked: null,
      tokens: {
        nextToken: () => ({ lineno: 7, colno: 3, type: 'symbol', value: 'x' }),
      },
    };
    const err = error(ctx, 'test error');
    expect(err.lineno).toBe(7);
    expect(err.colno).toBe(3);
  });

  test('falls back to tokenizer position at end of file', () => {
    const ctx = {
      peeked: null,
      tokens: {
        lineno: 2,
        colno: 14,
        nextToken: () => null,
      },
    };
    const err = error(ctx, 'test error');
    expect(err.lineno).toBe(2);
    expect(err.colno).toBe(14);
  });
});

describe('fail', () => {
  test('throws TemplateError with given message', () => {
    expect(() => fail(null, 'fail msg', 1, 2)).toThrow('fail msg');
  });

  test('thrown error has phase parse', () => {
    try {
      fail(null, 'msg', 1, 2);
    } catch (e) {
      expect(e.phase).toBe('parse');
    }
  });

  test('throws error with correct lineno', () => {
    try {
      fail(null, 'msg', 99, 1);
    } catch (e) {
      expect(e.lineno).toBe(99);
    }
  });
});
