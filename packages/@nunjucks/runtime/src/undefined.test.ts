import { describe, expect, test } from 'bun:test';
import { DEFAULT_UNDEFINED_MODE, isValidUndefinedMode, UNDEFINED_MODES } from './undefined.ts';

describe('UNDEFINED_MODES', () => {
  test('contains expected modes', () => {
    expect(UNDEFINED_MODES).toContain('strict');
    expect(UNDEFINED_MODES).toContain('debug');
    expect(UNDEFINED_MODES).toContain('chainable');
  });
});

describe('DEFAULT_UNDEFINED_MODE', () => {
  test('is chainable', () => {
    expect(DEFAULT_UNDEFINED_MODE).toBe('chainable');
  });
});

describe('isValidUndefinedMode', () => {
  test('returns true for valid modes', () => {
    expect(isValidUndefinedMode('strict')).toBe(true);
    expect(isValidUndefinedMode('debug')).toBe(true);
    expect(isValidUndefinedMode('chainable')).toBe(true);
  });

  test('returns false for invalid modes', () => {
    expect(isValidUndefinedMode('strict ')).toBe(false);
    expect(isValidUndefinedMode('STRICT')).toBe(false);
    expect(isValidUndefinedMode('')).toBe(false);
    expect(isValidUndefinedMode('invalid')).toBe(false);
    expect(isValidUndefinedMode(null)).toBe(false);
    expect(isValidUndefinedMode(undefined)).toBe(false);
  });
});
