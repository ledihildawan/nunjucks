import { describe, test, expect } from 'bun:test';
import { readErrorCode } from './read-error-code.ts';

describe('readErrorCode', () => {
  test('reads a string code off an object', () => {
    expect(readErrorCode({ code: 'ENOENT' })).toBe('ENOENT');
  });

  test('returns null when the code property is missing or non-string', () => {
    expect(readErrorCode({})).toBe(null);
    expect(readErrorCode({ code: 42 })).toBe(null);
  });

  test('returns null for plain Error instances without a code', () => {
    expect(readErrorCode(new Error('boom'))).toBe(null);
  });

  test('reads the code attached to an Error instance', () => {
    const failure = Object.assign(new Error('denied'), { code: 'EACCES' });
    expect(readErrorCode(failure)).toBe('EACCES');
  });

  test('returns null for non-object values', () => {
    expect(readErrorCode('ENOENT')).toBe(null);
    expect(readErrorCode(null)).toBe(null);
    expect(readErrorCode([1, 2])).toBe(null);
  });
});
