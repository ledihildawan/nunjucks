import { describe, test, expect } from 'bun:test';
import { buildErrorSections } from './to-html-assembly.ts';
import type { ErrorLike } from '@nunjucks/error-catalog';

const createFakeError = (overrides: Partial<ErrorLike> = {}): ErrorLike => ({
  message: 'Test error message',
  phase: 'render',
  ...overrides,
});

describe('buildErrorSections', () => {
  test('returns all required sections', () => {
    const error = createFakeError();
    const result = buildErrorSections({ error });
    expect(result.header).toBeDefined();
    expect(result.body).toBeDefined();
    expect(result.footer).toBeDefined();
    expect(result.wrapped).toBeDefined();
    expect(result.message).toBeDefined();
  });

  test('returns error severity by default', () => {
    const error = createFakeError();
    const result = buildErrorSections({ error });
    expect(result.severity).toBe('error');
  });

  test('builds wrapped HTML with header, body, and footer', () => {
    const error = createFakeError();
    const result = buildErrorSections({ error });
    expect(result.wrapped).toContain(result.header);
    expect(result.wrapped).toContain(result.body);
    expect(result.wrapped).toContain(result.footer);
  });

  test('uses templatePath from options when provided', () => {
    const error = createFakeError();
    const result = buildErrorSections({ error, templatePath: 'test.html' });
    expect(result.displayPath).toBeDefined();
  });

  test('canLinkLocation is true for absolute file paths', () => {
    const error = createFakeError();
    const result = buildErrorSections({ error, templatePath: '/absolute/path.html' });
    expect(result.canLinkLocation).toBe(true);
  });

  test('canLinkLocation is false for relative paths', () => {
    const error = createFakeError();
    const result = buildErrorSections({ error, templatePath: 'not/a/path' });
    expect(result.canLinkLocation).toBe(false);
  });

  test('uses error timestamp when options.timestamp not provided', () => {
    const error = createFakeError({ timestamp: '2024-01-01T00:00:00Z' });
    const result = buildErrorSections({ error });
    expect(result.footer).toContain('2024-01-01');
  });

  test('uses options timestamp over error timestamp', () => {
    const error = createFakeError({ timestamp: '2024-01-01T00:00:00Z' });
    const result = buildErrorSections({ error, timestamp: '2025-01-01T00:00:00Z' });
    expect(result.footer).toContain('2025-01-01');
  });
});
