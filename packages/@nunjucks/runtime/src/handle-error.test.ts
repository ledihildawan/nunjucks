import { describe, expect, test } from 'bun:test';
import { handleError } from './handle-error.ts';

describe('handleError', () => {
  test('rethrows an error that already has lineno', () => {
    const err = new Error('test') as Error & { lineno?: number };
    err.lineno = 5;
    expect(() => handleError(err, { lineno: 1, colno: 2 })).toThrow(err);
  });

  test('attaches lineno/colno to the normalized error', () => {
    try {
      handleError(new Error('boom'), { lineno: 3, colno: 7 });
      throw new Error('expected handleError to throw');
    } catch (e) {
      expect((e as { lineno: number }).lineno).toBe(3);
      expect((e as { colno: number }).colno).toBe(7);
    }
  });

  test('preserves code and subject from original error', () => {
    const err = new Error('x') as Error & { code?: string; subject?: string };
    err.code = 'MY_CODE';
    err.subject = 'myVar';
    try {
      handleError(err, { lineno: 1, colno: 2 });
    } catch (e) {
      expect((e as { code: string }).code).toBe('MY_CODE');
      expect((e as { subject: string }).subject).toBe('myVar');
    }
  });

  test('normalizes primitive thrown values', () => {
    for (const value of ['boom', 42, null, undefined]) {
      try {
        handleError(value, { lineno: 3, colno: 7 });
      } catch (e) {
        expect((e as { code: string }).code).toBe('RUNTIME_ERROR');
        expect((e as { lineno: number }).lineno).toBe(3);
      }
    }
  });

  test('handles frozen errors without mutating the original', () => {
    const error = Object.freeze(new Error('frozen'));
    try {
      handleError(error, { lineno: 2, colno: 4 });
    } catch (normalized) {
      expect((normalized as Error).message).toBe('frozen');
      expect((normalized as { lineno: number }).lineno).toBe(2);
    }
  });
});
