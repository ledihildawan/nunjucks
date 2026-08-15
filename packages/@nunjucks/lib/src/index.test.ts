import { describe, expect, test } from 'bun:test';
import { err, escapeHtml, isKeyedObject, ok, readErrorCode } from './index.ts';

describe('lib barrel', () => {
  test('re-exports the result, guard, escape, and error-code primitives', () => {
    expect(typeof ok).toBe('function');
    expect(typeof err).toBe('function');
    expect(typeof isKeyedObject).toBe('function');
    expect(typeof escapeHtml).toBe('function');
    expect(typeof readErrorCode).toBe('function');
  });
});
