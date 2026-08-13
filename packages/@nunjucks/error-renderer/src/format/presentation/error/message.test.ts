import { describe, test, expect } from 'bun:test';
import { getErrorMessage } from '@nunjucks/error-catalog/get-error-message';

describe('getErrorMessage', () => {
  test('returns message string from error', () => {
    expect(getErrorMessage({ message: 'something failed' })).toBe('something failed');
  });

  test('falls back to String(error) when message is missing', () => {
    expect(getErrorMessage({})).toBe('[object Object]');
  });

  test('truncates at embedded stack trace', () => {
    const err = { message: 'real error\n    at foo (bar.js:1:1)\n    at baz (qux.js:2:2)' };
    expect(getErrorMessage(err)).toBe('real error');
  });

  test('handles non-object input', () => {
    expect(getErrorMessage(42)).toBe('42');
  });

  test('throws on null (property access on null)', () => {
    expect(() => getErrorMessage(null)).toThrow();
  });
});
