import { describe, test, expect } from 'bun:test';
import {
  UNDEFINED_MODES,
  DEFAULT_UNDEFINED_MODE,
  isValidUndefinedMode,
  getUndefinedMode
} from './undefined.js';

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

describe('getUndefinedMode', () => {
  test('returns mode from opts when valid', () => {
    expect(getUndefinedMode({ undefined: 'strict' })).toBe('strict');
    expect(getUndefinedMode({ undefined: 'debug' })).toBe('debug');
    expect(getUndefinedMode({ undefined: 'chainable' })).toBe('chainable');
  });

  test('returns default when opts.undefined is undefined', () => {
    expect(getUndefinedMode({})).toBe('chainable');
    expect(getUndefinedMode({ undefined: null })).toBe('chainable');
    expect(getUndefinedMode({ undefined: undefined })).toBe('chainable');
  });

  test('returns default when opts.undefined is invalid', () => {
    expect(getUndefinedMode({ undefined: 'invalid' })).toBe('chainable');
    expect(getUndefinedMode({ undefined: 'strict ' })).toBe('chainable');
  });

  test('returns default when opts is null', () => {
    expect(getUndefinedMode(null)).toBe('chainable');
  });

  test('returns default when opts is undefined', () => {
    expect(getUndefinedMode(undefined)).toBe('chainable');
  });
});
