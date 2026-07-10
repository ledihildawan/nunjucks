import { describe, test, expect } from 'bun:test';
import { toHtmlString } from './template.js';

const createMinState = (overrides = {}) => ({
  message: '  Error: Something went wrong',
  classified: {
    category: 'template_error',
    causes: ['Check variable names', 'Check template syntax'],
    fixCode: '{{ foo }}',
    fixComment: 'Use correct variable name',
  },
  templateName: 'index.html',
  line: 10,
  col: 5,
  code: 'TMPL_ERR',
  phase: 'render',
  templatePath: '/app/views/index.html',
  snippet: '  1: hello\n>>> 2: {{ foo }}\n  3: world',
  getDisplayLine: () => 10,
  getDisplayCol: () => 5,
  isProduction: false,
  originalError: new Error('Something went wrong'),
  renderContext: { foo: 'bar', count: 42 },
  ide: 'vscode',
  version: '3.2.4',
  timestamp: null,
  ...overrides,
});

describe('toHtmlString', () => {
  test('returns production page when isProduction is true', () => {
    const result = toHtmlString(createMinState({ isProduction: true }));
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html lang="en">');
    expect(result).toContain('Rendering Interrupted');
    expect(result).toContain('Internal Server Error');
    expect(result).toContain('Try Again');
    expect(result).not.toContain('Template Rendering Error');
    expect(result).not.toContain('Possible Causes');
  });

  test('returns full error page in dev mode', () => {
    const result = toHtmlString(createMinState());
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html lang="en">');
    expect(result).toContain('Template Rendering Error');
    expect(result).toContain('TMPL_ERR');
    expect(result).toContain('render');
    expect(result).toContain('DEV');
    expect(result).toContain('Source Trace');
    expect(result).toContain('Possible Causes');
    expect(result).toContain('Suggested Fix');
    expect(result).toContain('/app/views/index.html');
  });

  test('includes error message in title', () => {
    const result = toHtmlString(createMinState());
    expect(result).toContain('<title>Error: Something went wrong</title>');
  });

  test('includes causes list', () => {
    const result = toHtmlString(createMinState());
    expect(result).toContain('Check variable names');
    expect(result).toContain('Check template syntax');
  });

  test('includes fix code with comment', () => {
    const result = toHtmlString(createMinState());
    expect(result).toContain('Use correct variable name');
    expect(result).toContain('syntax-delimiter');
    expect(result).toContain('syntax-variable');
  });

  test('includes script toggle', () => {
    const result = toHtmlString(createMinState());
    expect(result).toContain('<script>');
    expect(result).toContain('initStackToggle');
    expect(result).toContain('</script>');
  });

  test('supports CSP nonce on script and style', () => {
    const state = createMinState({ csp: { nonce: 'abc123' } });
    const result = toHtmlString(state);
    expect(result).toContain('nonce="abc123"');
  });

  test('handles missing templatePath', () => {
    const result = toHtmlString(createMinState({ templatePath: null }));
    expect(result).toContain('Template Rendering Error');
    expect(result).toContain('error-location-text');
    expect(result).not.toContain('class="loc-link');
  });

  test('handles missing code and phase', () => {
    const state = createMinState({ code: null, phase: null });
    const result = toHtmlString(state);
    expect(result).not.toContain('class="badge badge-error"');
    expect(result).not.toContain('class="badge badge-code"');
  });

  test('handles missing fixComment', () => {
    const state = createMinState({ classified: { ...createMinState().classified, fixComment: null } });
    const result = toHtmlString(state);
    expect(result).not.toContain('class="syntax-comment"');
  });

  test('includes timestamp in production when provided', () => {
    const result = toHtmlString(createMinState({ isProduction: true, timestamp: '2024-01-01' }));
    expect(result).toContain('2024-01-01');
  });

  test('includes timestamp in footer when provided', () => {
    const result = toHtmlString(createMinState({ timestamp: '2024-01-01' }));
    expect(result).toContain('2024-01-01');
  });

  test('includes version in footer', () => {
    const result = toHtmlString(createMinState());
    expect(result).toContain('3.2.4');
  });

  test('includes IDE link in footer', () => {
    const result = toHtmlString(createMinState());
    expect(result).toContain('btn-solid');
    expect(result).toContain('Open in');
  });

  test('renders code trace section', () => {
    const result = toHtmlString(createMinState());
    expect(result).toContain('code-block');
    expect(result).toContain('code-line');
  });

  test('renders context section', () => {
    const result = toHtmlString(createMinState());
    expect(result).toContain('ctx-tree');
  });

  test('includes stack trace section', () => {
    const result = toHtmlString(createMinState());
    expect(result).toContain('stack-trace');
  });
});
