import { describe, expect, test } from 'bun:test';
import { DEFAULT_UNDEFINED_MODE, UNDEFINED_MODES } from './undefined.ts';

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
