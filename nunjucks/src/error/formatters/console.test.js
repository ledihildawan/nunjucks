import { describe, test, expect } from 'bun:test';
import { toConsoleString } from './console.js';

describe('toConsoleString', () => {
  test('renders production mode with minimal output', () => {
    const result = toConsoleString({
      isProduction: true,
      code: 'UNDEFINED_VARIABLE',
      phase: 'render',
      version: '3.2.4',
      timestamp: '2024-01-01T00:00:00Z',
    });
    expect(result).toContain('[ERROR]');
    expect(result).toContain('[UNDEFINED_VARIABLE]');
    expect(result).toContain('Check logs for details');
  });

  test('renders dev mode with full details', () => {
    const result = toConsoleString({
      code: 'UNDEFINED_VARIABLE',
      phase: 'render',
      snippet: '1: hello\n>>>2: {{ x }}\n3: world',
      classified: {
        causes: ['Variable not defined in context'],
        fixComment: 'Define the variable',
        fixCode: '{% set x = value %}',
      },
      isProduction: false,
      originalError: new Error('x is not defined'),
      renderContext: { x: undefined },
      getDisplayLine: () => 2,
      getDisplayCol: () => 1,
    });
    expect(result).toContain('[ERROR]');
    expect(result).toContain('Template Rendering Failed');
    expect(result).toContain('[UNDEFINED_VARIABLE]');
    expect(result).toContain('Define the variable');
    expect(result).toContain('Stack Trace:');
  });

  test('handles minimal state without snippet', () => {
    const result = toConsoleString({
      isProduction: false,
      classified: {
        causes: ['Something went wrong'],
        fixComment: 'Check your template',
        fixCode: 'Fix it',
      },
      templatePath: '/path/to/template.html:1:1',
      getDisplayLine: () => '?',
      getDisplayCol: () => '?',
    });
    expect(result).toContain('Template Rendering Failed');
    expect(result).toContain('Check your template');
  });

  test('handles null render context', () => {
    const result = toConsoleString({
      isProduction: false,
      classified: {
        causes: ['Cause'],
        fixComment: 'Fix',
        fixCode: 'doFix()',
      },
      getDisplayLine: () => '?',
      getDisplayCol: () => '?',
      renderContext: null,
    });
    expect(result).not.toContain('Render Context:');
  });

  test('filters blocked keys from render context', () => {
    const result = toConsoleString({
      isProduction: false,
      classified: {
        causes: ['Cause'],
        fixComment: 'Fix',
        fixCode: 'doFix()',
      },
      getDisplayLine: () => '?',
      getDisplayCol: () => '?',
      renderContext: {
        name: 'Alice',
        __proto__: { dangerous: true },
        constructor: { dangerous: true },
        toString: () => 'test'
      },
    });
    expect(result).toContain('name = Alice');
    expect(result).not.toContain('__proto__');
    expect(result).not.toContain('constructor');
    expect(result).not.toContain('toString');
  });

  test('filters __nunjucks keys from render context', () => {
    const result = toConsoleString({
      isProduction: false,
      classified: {
        causes: ['Cause'],
        fixComment: 'Fix',
        fixCode: 'doFix()',
      },
      getDisplayLine: () => '?',
      getDisplayCol: () => '?',
      renderContext: {
        foo: 'bar',
        __nunjucks_internal: true,
      },
    });
    expect(result).toContain('foo = bar');
    expect(result).not.toContain('__nunjucks');
  });
});
