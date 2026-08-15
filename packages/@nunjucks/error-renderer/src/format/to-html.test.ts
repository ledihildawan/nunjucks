import { describe, expect, test } from 'bun:test';
import type { ErrorLike } from '@nunjucks/error-catalog';
import { toHtml } from './to-html.ts';

describe('toHtml', () => {
  test('returns production body when error is null', () => {
    const result = toHtml(null, {});
    expect(result).toContain('Rendering Interrupted');
    expect(result).toContain('500');
  });

  test('returns production body when isProduction is true', () => {
    const error = { message: 'Test error' } as ErrorLike;
    const result = toHtml(error, { isProduction: true });
    expect(result).toContain('Rendering Interrupted');
    expect(result).toContain('500');
  });

  test('returns error document for non-production error', () => {
    const error = { message: 'Runtime error', phase: 'render' } as ErrorLike;
    const result = toHtml(error, {});
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('</html>');
  });

  test('includes template path in error document', () => {
    const error = { message: 'Error', phase: 'render' } as ErrorLike;
    const result = toHtml(error, { templatePath: 'test.html' });
    expect(result).toContain('test.html');
  });

  test('includes line and column info when provided', () => {
    const error = { message: 'Error', phase: 'render' } as ErrorLike;
    const result = toHtml(error, { lineno: 5, colno: 10 });
    expect(result).toContain('5');
    expect(result).toContain('10');
  });

  test('includes timestamp when provided', () => {
    const error = { message: 'Error', phase: 'render' } as ErrorLike;
    const result = toHtml(error, { timestamp: '2024-01-01T00:00:00Z' });
    expect(result).toContain('2024-01-01');
  });

  test('includes custom CSP nonce when provided', () => {
    const error = { message: 'Error', phase: 'render' } as ErrorLike;
    const result = toHtml(error, { csp: { nonce: 'abc123' } });
    expect(result).toContain('nonce="abc123"');
  });

  test('builds valid HTML document structure', () => {
    const error = { message: 'Error', phase: 'render' } as ErrorLike;
    const result = toHtml(error, {});
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html lang="en">');
    expect(result).toContain('<title>');
    expect(result).toContain('</html>');
  });
});
