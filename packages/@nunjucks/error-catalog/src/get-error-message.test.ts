import { describe, expect, test } from 'bun:test';
import { getErrorMessage } from './get-error-message.ts';

describe('getErrorMessage', () => {
  test('reads the message of a real Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  test('falls back to String() for non-Error values', () => {
    expect(getErrorMessage('plain string')).toBe('plain string');
    expect(getErrorMessage(42)).toBe('42');
  });

  test('does not throw for null and undefined', () => {
    expect(getErrorMessage(null)).toBe('null');
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  test('falls back for error-like objects without a string message', () => {
    expect(getErrorMessage({ message: 123 })).toBe('[object Object]');
  });

  test('trims the stack from a multi-line message', () => {
    const error = new Error('headline');
    const message = getErrorMessage(`${error.message}\n    at somewhere (file.ts:1:1)`);
    expect(message).toBe('headline');
  });

  test('keeps messages that contain no stack frames intact', () => {
    expect(getErrorMessage('no frames here')).toBe('no frames here');
  });
});
