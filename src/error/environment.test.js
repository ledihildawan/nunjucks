import { describe, test, expect } from 'bun:test';
import { createEnvironment, getEnvironment, renderError, renderErrorString, createErrorFormatter } from './environment.js';

describe('createEnvironment', () => {
  test('creates environment with default options', () => {
    const env = createEnvironment();
    expect(env.opts).toBeDefined();
    expect(typeof env.formatError).toBe('function');
  });

  test('merges custom options with defaults', () => {
    const env = createEnvironment({ dev: true, ide: 'cursor' });
    expect(env.opts.dev).toBe(true);
    expect(env.opts.ide).toBe('cursor');
  });

  test('formatError returns error result object', async () => {
    const error = new Error('test error');
    error.lineno = 5;
    error.colno = 3;
    const env = createEnvironment({ fs: { readFileSync: () => null } });
    const result = await env.formatError(error, 'template.html');
    expect(result.name).toBe('NunjucksError');
    expect(result.message).toBe('test error');
    expect(result.getSrcLine()).toBe(6);
    expect(result.getSrcCol()).toBe(4);
    expect(typeof result.toConsoleString).toBe('function');
    expect(typeof result.toHtmlString).toBe('function');
  });

  test('formatError handles CSP nonce from headers', async () => {
    const error = new Error('test');
    const env = createEnvironment({
      csp: { enabled: true, nonceHeader: 'x-csp-nonce' },
      fs: { readFileSync: () => null },
    });
    const result = await env.formatError(error, 't.html', {
      requestHeaders: { 'x-csp-nonce': 'abc123' },
    });
    expect(result.csp).toBe('abc123');
  });

  test('formatError uses custom nonce generator', async () => {
    const error = new Error('test');
    const env = createEnvironment({
      csp: { enabled: true, nonceGenerator: () => 'generated-nonce' },
      fs: { readFileSync: () => null },
    });
    const result = await env.formatError(error, 't.html');
    expect(result.csp).toBe('generated-nonce');
  });

  test('formatError reads source file', async () => {
    const error = new Error('test');
    error.lineno = 1;
    const env = createEnvironment({
      fs: { readFileSync: () => 'line1\nline2\nline3' },
    });
    const result = await env.formatError(error, 't.html', {
      templatePath: '/path/to/template.html',
    });
    expect(result.snippet).toBeDefined();
  });
});

describe('getEnvironment', () => {
  test('returns singleton default environment', () => {
    const env1 = getEnvironment();
    const env2 = getEnvironment();
    expect(env1).toBe(env2);
  });
});

describe('createErrorFormatter', () => {
  test('creates environment with options', () => {
    const fmt = createErrorFormatter({ dev: true });
    expect(fmt.opts.dev).toBe(true);
  });
});

describe('renderError', () => {
  test('renders error to error result object with toHtmlString', async () => {
    const error = new Error('render test');
    error.lineno = 0;
    const result = await renderError(error, 'test.html');
    expect(typeof result).toBe('object');
    expect(result.name).toBe('NunjucksError');
    expect(typeof result.toHtmlString).toBe('function');
    expect(typeof result.toHtmlString()).toBe('string');
  });
});

describe('renderErrorString', () => {
  test('renders error with template string', async () => {
    const error = new Error('string test');
    const html = await renderErrorString(error, 'template string');
    expect(typeof html).toBe('string');
  });
});
