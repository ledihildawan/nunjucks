import { describe, expect, test } from 'bun:test';
import { FATAL_STREAM_CODES, isFatalStreamError } from './stream-fatal-codes.ts';

describe('FATAL_STREAM_CODES', () => {
  test('contains the conservative fatal set', () => {
    expect(FATAL_STREAM_CODES.has('SANDBOX_CODE_EXECUTION')).toBe(true);
    expect(FATAL_STREAM_CODES.has('CIRCULAR_INCLUDE')).toBe(true);
    expect(FATAL_STREAM_CODES.has('TIMEOUT')).toBe(true);
  });

  test('excludes recoverable per-expression codes', () => {
    expect(FATAL_STREAM_CODES.has('NULL_VALUE')).toBe(false);
    expect(FATAL_STREAM_CODES.has('UNDEFINED_VARIABLE')).toBe(false);
    expect(FATAL_STREAM_CODES.has('SANDBOX_ACCESS')).toBe(false);
  });
});

describe('isFatalStreamError', () => {
  test('returns true for each fatal code', () => {
    for (const code of FATAL_STREAM_CODES) {
      expect(isFatalStreamError({ code })).toBe(true);
    }
  });

  test('returns true for an Error instance carrying a fatal code', () => {
    const fatal = Object.assign(new Error('timed out'), { code: 'TIMEOUT' });
    expect(isFatalStreamError(fatal)).toBe(true);
  });

  test('returns false for recoverable runtime/data codes', () => {
    expect(isFatalStreamError({ code: 'NULL_VALUE' })).toBe(false);
    expect(isFatalStreamError({ code: 'UNDEFINED_VARIABLE' })).toBe(false);
    expect(isFatalStreamError({ code: 'FILTER_TYPE_ERROR' })).toBe(false);
    expect(isFatalStreamError({ code: 'SANDBOX_ACCESS' })).toBe(false);
  });

  test('returns false for an error without a code (fail-open to inline marker)', () => {
    expect(isFatalStreamError(new Error('no code here'))).toBe(false);
    expect(isFatalStreamError({ message: 'no code' })).toBe(false);
  });

  test('returns false for non-error inputs', () => {
    expect(isFatalStreamError(null)).toBe(false);
    expect(isFatalStreamError(undefined)).toBe(false);
    expect(isFatalStreamError('string error')).toBe(false);
  });

  test('returns false for a non-string code', () => {
    expect(isFatalStreamError({ code: 123 })).toBe(false);
    expect(isFatalStreamError({ code: null })).toBe(false);
  });
});
