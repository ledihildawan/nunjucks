import { describe, test, expect } from 'bun:test';
import { injectWarningsScript } from './collector.ts';
import type { Warning } from '@nunjucks/error-catalog';

describe('injectWarningsScript', () => {
  test('returns empty string for null', () => {
    expect(injectWarningsScript(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(injectWarningsScript(undefined)).toBe('');
  });

  test('returns empty string for empty array', () => {
    expect(injectWarningsScript([])).toBe('');
  });

  test('produces a script tag for a single warning', () => {
    const warnings: Warning[] = [{ message: 'test', varName: 'x', lineno: 5 }];
    const result = injectWarningsScript(warnings);
    expect(result).toContain('<script');
    expect(result).toContain('console.warn');
    expect(result).toContain('__nunjucks_warnings__');
  });

  test('handles warning with code', () => {
    const warnings: Warning[] = [{ message: 'test', code: 'UNDEFINED_VAR' }];
    const result = injectWarningsScript(warnings);
    expect(result).toContain('UNDEFINED_VAR');
  });

  test('handles multiple warnings', () => {
    const warnings: Warning[] = [
      { message: 'first', varName: 'a' },
      { message: 'second', varName: 'b' },
    ];
    const result = injectWarningsScript(warnings);
    expect(result).toContain('first');
    expect(result).toContain('second');
  });
});
