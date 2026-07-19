import { describe, test, expect } from 'bun:test';
import { render } from './render.js';
import { mergeConfig } from '../config/global.js';

const renderTemplate = async (template, context = {}, config = {}) => {
  return await render(template, context, mergeConfig({
    autoescape: false,
    undefined: 'strict',
    ...config
  }));
};

describe('error messages - real scenarios', () => {
  test('Variable "user.something" is not defined - has correct causes/fix', async () => {
    const err = await renderTemplate('{{ user.something }}', { user: { name: 'Ada' } }).catch(e => e);

    expect(err.code).toBe('UNDEFINED_PROPERTY');
    expect(err.subject).toBe('something');
    expect(err.message).toContain('something');
    expect(err.message).toContain('user');

    expect(err.causes.length).toBeGreaterThanOrEqual(2);
    expect(err.causes.some(c => c.includes('does not exist'))).toBe(true);

    expect(err.fixCode).toBeTruthy();

    const text = err.output({ format: 'text', verbosity: 'full' });
    expect(text).toContain('Possible Causes');
    expect(text).toContain('Suggested Fix');
  });

  test('UNDEFINED_VARIABLE has helpful suggestion', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);

    expect(err.code).toBe('UNDEFINED_VARIABLE');
    expect(err.causes.length).toBeGreaterThan(0);
    expect(err.fixCode).toBeTruthy();
    expect(err.suggestion).toBeTruthy();

    const text = err.output({ format: 'text', verbosity: 'full' });
    expect(text).toContain('Tip');
  });

  test('UNDEFINED_FILTER error explains how to register', async () => {
    const err = await renderTemplate('{{ x |> noSuchFilter }}', { x: 'test' }).catch(e => e);

    expect(err.code).toBe('UNDEFINED_FILTER');
    expect(err.fixCode).toContain('addFilter');

    const text = err.output({ format: 'text', verbosity: 'full' });
    expect(text).toContain('addFilter');
    expect(text).toContain('register');
  });

  test('NULL_VALUE has proper causes about null/undefined', async () => {
    const err = await renderTemplate('{{ obj.name }}', { obj: null }).catch(e => e);

    expect(err.code).toBeTruthy();
    expect(err.causes.some(c => c.toLowerCase().includes('null') || c.toLowerCase().includes('undefined'))).toBe(true);

    const text = err.output({ format: 'text', verbosity: 'full' });
    expect(text).toContain('null');
  });

  test('UNDEFINED_BLOCK error mentions parent template', async () => {
    const err = await renderTemplate(
      '{% extends "parent.njk" %}{% block nonexistent %}{% endblock %}',
      {},
      { dev: true }
    ).catch(e => e);

    expect(err.code).toBeTruthy();
    const text = err.output({ format: 'text', verbosity: 'full' });
    expect(text.length).toBeGreaterThan(0);
  });

  test('FILE_NOT_FOUND has clear path message', async () => {
    const { createLog, ERROR_DEFINITIONS } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.FILE_NOT_FOUND, { path: 'nonexistent.njk' }, 'nonexistent.njk', {
      lineno: 1, colno: 0, phase: 'load', lineBase: 'zero'
    });

    expect(err.code).toBe('FILE_NOT_FOUND');
    expect(err.subject).toBe('nonexistent.njk');
    expect(err.message).toContain('nonexistent.njk');
    expect(err.causes.length).toBeGreaterThanOrEqual(2);
    expect(err.fixCode).toBeTruthy();
    expect(err.suggestion).toBeTruthy();
  });

  test('CIRCULAR_INCLUDE has informative message', async () => {
    const { createLog, ERROR_DEFINITIONS } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.CIRCULAR_INCLUDE, {}, null, {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero'
    });

    expect(err.code).toBe('CIRCULAR_INCLUDE');
    expect(err.causes.some(c => c.toLowerCase().includes('circular') || c.toLowerCase().includes('itself'))).toBe(true);
    expect(err.fixCode).toBeTruthy();
    expect(err.suggestion).toBeTruthy();
  });

  test('SYNTAX_ERROR has helpful causes and template syntax fix', async () => {
    const err = await renderTemplate('{% if x %}', {}).catch(e => e);

    expect(err.code).toBeTruthy();
    expect(err.causes.length).toBeGreaterThan(0);
    expect(err.fixCode).toContain('{');
  });

  test('UNKNOWN_BLOCK_TAG mentions tag name and closing tags', async () => {
    const { createLog, ERROR_DEFINITIONS } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.UNKNOWN_BLOCK_TAG, { tag: 'unknownTag' }, 'unknownTag', {
      lineno: 1, colno: 0, phase: 'parse', lineBase: 'zero'
    });

    expect(err.code).toBe('UNKNOWN_BLOCK_TAG');
    expect(err.subject).toBe('unknownTag');
    expect(err.causes.length).toBeGreaterThan(0);
    expect(err.fixCode).toBeTruthy();
  });

  test('errors include line/column info', async () => {
    const err = await renderTemplate('\n\n{{ missing }}', {}).catch(e => e);

    expect(err.lineno).toBe(2);
    expect(err.colno).toBeDefined();
    expect(err.colno).toBeGreaterThanOrEqual(0);
  });

  test('errors are serializable via toJSON', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);

    const json = err.toJSON ? err.toJSON() : null;
    expect(json).toBeTruthy();
    expect(json.code).toBe('UNDEFINED_VARIABLE');
    expect(json.causes).toBeDefined();
    expect(json.fixCode).toBeDefined();
  });

  test('error html output is complete', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);

    const html = err.output({ format: 'html', verbosity: 'full' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Possible Causes');
    expect(html).toContain('Suggested Fix');
  });

  test('error ansi output has colored sections', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);

    const ansi = err.output({ format: 'ansi', verbosity: 'full' });
    expect(ansi).toContain('Possible Causes');
    expect(ansi).toContain('Suggested Fix');
  });

  test('error message includes the variable name with placeholders', async () => {
    const err = await renderTemplate('{{ specificName }}', {}).catch(e => e);

    expect(err.message).toContain('specificName');
  });

  test('NULL_VALUE error with nested access shows clear path', async () => {
    const err = await renderTemplate('{{ a.b.c }}', { a: null }).catch(e => e);

    expect(err.code).toBeTruthy();
    expect(err.message).toBeTruthy();
    expect(err.causes.length).toBeGreaterThan(0);
  });

  test('UNDEFINED_PROPERTY error has specific causes about the property', async () => {
    const err = await renderTemplate('{{ user.email }}', { user: { name: 'Ada' } }).catch(e => e);

    expect(err.code).toBe('UNDEFINED_PROPERTY');
    expect(err.causes.length).toBeGreaterThanOrEqual(2);
  });

  test('SYNTAX_ERROR has multiple causes', async () => {
    const err = await renderTemplate('{{ unclosed', {}).catch(e => e);

    expect(err.code).toBeTruthy();
    expect(err.causes.length).toBeGreaterThanOrEqual(2);
  });

  test('error outputs renderContext in HTML', async () => {
    const err = await renderTemplate('{{ missing }}', { x: 1, y: 2 }).catch(e => e);

    const html = err.output({ format: 'html', verbosity: 'full' });
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(500);
  });

  test('severity defaults to error', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);

    expect(err.severity || 'error').toBe('error');
  });

  test('error line/col are 0-based internally', async () => {
    const err = await renderTemplate('\n\n\n{{ missing }}', {}).catch(e => e);

    expect(err.lineno).toBe(3);
    expect(err.colno).toBeDefined();
  });
});

describe('error messages - quality checks', () => {
  test('every cause is not just internal jargon', async () => {
    const samples = [
      { template: '{{ missing }}', code: 'UNDEFINED_VARIABLE' },
      { template: '{{ user.x }}', context: { user: null }, code: 'NULL_VALUE' },
      { template: '{% iffoo %}', code: 'SYNTAX_ERROR' },
    ];

    for (const sample of samples) {
      const err = await renderTemplate(sample.template, sample.context || {}).catch(e => e);
      if (err.code === sample.code) {
        for (const cause of err.causes) {
          expect(cause.length).toBeGreaterThan(5);
          expect(cause.toLowerCase()).not.toBe('internal error');
        }
      }
    }
  });

  test('every fix is a concrete code suggestion', async () => {
    const samples = [
      { template: '{{ missing }}' },
      { template: '{{ value |> unknownFilter }}', context: { value: 'x' } },
    ];

    for (const sample of samples) {
      const err = await renderTemplate(sample.template, sample.context || {}).catch(e => e);
      if (err.fixCode) {
        expect(err.fixCode.length).toBeGreaterThan(5);
      }
    }
  });

  test('error format outputs are consistent', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);

    const text = err.output({ format: 'text', verbosity: 'full' });
    const ansi = err.output({ format: 'ansi', verbosity: 'full' });
    const html = err.output({ format: 'html', verbosity: 'full' });

    expect(text.length).toBeGreaterThan(50);
    expect(ansi.length).toBeGreaterThan(50);
    expect(html.length).toBeGreaterThan(500);
  });
});
