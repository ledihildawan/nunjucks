import { describe, test, expect } from 'bun:test';
import { createLog } from './create-log.ts';
import { ERROR_DEFINITIONS } from './errors/registry.ts';

const UNDEFINED_VARIABLE = ERROR_DEFINITIONS.UNDEFINED_VARIABLE!;
const FILE_NOT_FOUND = ERROR_DEFINITIONS.FILE_NOT_FOUND!;

describe('createLog', () => {
  test('outputs formatted error message', () => {
    const err = createLog('error', { message: 'Something went wrong', lineno: 1, colno: 0 });
    expect(err.output()).toContain('Something went wrong');
  });

  test('simple text output is just the message', () => {
    const err = createLog('error', { message: 'Just message', lineno: 1, colno: 0 });
    expect(err.output({ format: 'text', verbosity: 'simple' })).toBe('Just message');
  });

  test('displays one-based location', () => {
    const err = createLog('error', {
      message: 'Error',
      lineno: 5,
      colno: 10,
      info: { lineBase: 'one', templateName: 'test.njk' }
    });
    expect(err.output({ format: 'text', verbosity: 'medium' })).toContain('test.njk:5:10');
  });

  test('zero-based lineBase displays as one-based', () => {
    const err = createLog('error', {
      message: 'Error',
      lineno: 1,
      colno: 2,
      info: { templateName: 'a.njk', lineBase: 'zero' }
    });
    expect(err.output({ format: 'text', verbosity: 'medium' })).toContain('a.njk:2:3');
  });

  test('redacts sensitive data in render context', () => {
    const err = createLog('error', UNDEFINED_VARIABLE, { name: 'x' }, 'x', { templateName: 't.njk', lineno: 1 });
    const html = err.output({ format: 'html', renderContext: { password: 'secret', apiKey: 'token123' } });
    const ansi = err.output({ format: 'ansi', renderContext: { password: 'secret', apiKey: 'token123' } });
    for (const output of [html, ansi]) {
      expect(output).toContain('[Redacted]');
      expect(output).not.toContain('secret');
      expect(output).not.toContain('token123');
    }
  });

  test('links file paths but not inline locations', () => {
    const inline = createLog('error', UNDEFINED_VARIABLE, { name: 'x' }, 'x', { templateName: 'inline', lineno: 0, colno: 3 });
    const file = createLog('error', UNDEFINED_VARIABLE, { name: 'x' }, 'x', { templateName: '/path/page.njk', lineno: 0, colno: 3 });
    const inlineHtml = inline.output({ format: 'html', verbosity: 'full' });
    const fileHtml = file.output({ format: 'html', verbosity: 'full', ide: 'vscode' });
    expect(inlineHtml).toContain('inline:1:4');
    expect(inlineHtml).not.toContain('vscode://file/inline');
    expect(fileHtml).toContain('vscode://file/');
  });

  test('warning output shows warning label', () => {
    const warn = createLog('warning', { message: 'Warn', lineno: 1, colno: 0 });
    expect(warn.output()).toContain('[WARNING]');
  });

  test('warning includes version and timestamp', () => {
    const warn = createLog('warning', { message: 'Warn', lineno: 1, colno: 0 });
    const output = warn.output({ verbosity: 'full', version: '1.0.0', timestamp: '2026-01-01' });
    expect(output).toContain('Nunjucks 1.0.0');
    expect(output).toContain('2026-01-01');
  });

  test('throws for unknown log type', () => {
    expect(() => createLog('unknown' as any, FILE_NOT_FOUND, {})).toThrow('Unknown log type: unknown');
  });
});