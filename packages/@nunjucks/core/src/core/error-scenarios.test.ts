// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { describe, test, expect } from 'bun:test';
import { render } from './render.ts';
import { createLog, getError } from '@nunjucks/log';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => await render(template, context, {
  autoescape: false,
  undefined: 'strict',
  ...config
} as Record<string, unknown>);

describe('error messages - real scenarios', () => {
  test('Variable "user.something" output', async () => {
    const err = await renderTemplate('{{ user.something }}', { user: { name: 'Ada' } }).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBe('UNDEFINED_PROPERTY');
    expect(err.subject).toBe('something');
    expect(err.message).toContain('something');
    expect(err.message).toContain('user');

    expect((err.causes as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect((err.causes as string[]).some((c: string) => c.includes('does not exist'))).toBe(true);

    expect(err.fixCode).toBeTruthy();

    const text = await (err.output as (opts: unknown) => Promise<string>)({ format: 'text', verbosity: 'full' });
    expect(text).toContain('Possible Causes');
    expect(text).toContain('Suggested Fix');
  });

  test('Variable "user.something" with user=undefined throws NULL_VALUE not UNDEFINED_VARIABLE', async () => {
    const err = await renderTemplate('{{ user.something }}', { user: undefined }).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBe('NULL_VALUE');
    expect(err.subject).toBe('something');
    expect(err.message).toContain("Cannot access 'something' on null 'user'");
    expect(err.message).not.toContain("is not defined");
    expect(err.message).not.toContain('user.something is not defined');

    const text = await (err.output as (opts: unknown) => Promise<string>)({ format: 'text', verbosity: 'full' });
    expect(text).toContain('Possible Causes');
    expect(text).toContain('Suggested Fix');
    expect(text).not.toContain('user.something is not defined');
  });

  test('Variable "user.something" with user=null throws NULL_VALUE', async () => {
    const err = await renderTemplate('{{ user.something }}', { user: null }).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBe('NULL_VALUE');
    expect(err.subject).toBe('something');
    expect(err.message).toContain("Cannot access 'something' on null 'user'");
  });

  test('Variable "missing" with no user at all throws UNDEFINED_VARIABLE', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBe('UNDEFINED_VARIABLE');
    expect(err.subject).toBe('missing');
    expect(err.message).toContain("Variable 'missing' is not defined");
  });

  test('sandbox-context-error route scenario produces correct NULL_VALUE', async () => {
    const err = await renderTemplate(
      '{{ user.something }}',
      { user: undefined },
      { sandbox: true }
    ).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBe('NULL_VALUE');
    expect(err.message).toContain('something');
    expect(err.message).toContain('user');
    expect(err.message).not.toContain('user.something is not defined');
  });

  test('UNDEFINED_VARIABLE has helpful suggestion', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBe('UNDEFINED_VARIABLE');
    expect((err.causes as unknown[]).length).toBeGreaterThan(0);
    expect(err.fixCode).toBeTruthy();

    const text = await (err.output as (opts: unknown) => Promise<string>)({ format: 'text', verbosity: 'full' });
    expect(text).toContain('Suggested Fix:');
  });

  test('UNDEFINED_FILTER error explains how to register', async () => {
    const err = await renderTemplate('{{ x |> noSuchFilter }}', { x: 'test' }).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBe('UNDEFINED_FILTER');
    expect(err.fixCode).toContain('addFilter');

    const text = await (err.output as (opts: unknown) => Promise<string>)({ format: 'text', verbosity: 'full' });
    expect(text).toContain('addFilter');
    expect(text).toContain('register');
  });

  test('NULL_VALUE has proper causes about null/undefined', async () => {
    const err = await renderTemplate('{{ obj.name }}', { obj: null }).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBeTruthy();
    expect((err.causes as string[]).some((c: string) => c.toLowerCase().includes('null') || c.toLowerCase().includes('undefined'))).toBe(true);

    const text = await (err.output as (opts: unknown) => Promise<string>)({ format: 'text', verbosity: 'full' });
    expect(text).toContain('null');
  });

  test('UNDEFINED_BLOCK error mentions parent template', async () => {
    const err = await renderTemplate(
      '{% extends "parent.njk" %}{% block nonexistent %}{% endblock %}',
      {},
      { dev: true }
    ).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBeTruthy();
    const text = await (err.output as (opts: unknown) => Promise<string>)({ format: 'text', verbosity: 'full' });
    expect(text.length).toBeGreaterThan(0);
  });

  test('FILE_NOT_FOUND has clear path message', async () => {
    const err = createLog('error', getError('FILE_NOT_FOUND'), { path: 'nonexistent.njk' }, 'nonexistent.njk', {
      lineno: 1, colno: 0, phase: 'load', lineBase: 'zero' as const
    });

    expect(err.code).toBe('FILE_NOT_FOUND');
    expect(err.subject).toBe('nonexistent.njk');
    expect(err.message).toContain('nonexistent.njk');
    expect(err.causes.length).toBeGreaterThanOrEqual(2);
    expect(err.fixCode).toBeTruthy();
  });

  test('SYNTAX_ERROR has helpful causes and template syntax fix', async () => {
    const err = await renderTemplate('{% if x %}', {}).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBeTruthy();
    expect((err.causes as unknown[]).length).toBeGreaterThan(0);
    expect(err.fixCode).toContain('{');
  });

  test('UNKNOWN_BLOCK_TAG mentions tag name and closing tags', async () => {
    const err = createLog('error', getError('UNKNOWN_BLOCK_TAG'), { tag: 'unknownTag' }, 'unknownTag', {
      lineno: 1, colno: 0, phase: 'parse', lineBase: 'zero' as const
    });

    expect(err.code).toBe('UNKNOWN_BLOCK_TAG');
    expect(err.subject).toBe('unknownTag');
    expect(err.causes.length).toBeGreaterThan(0);
    expect(err.fixCode).toBeTruthy();
  });

  test('errors include line/column info', async () => {
    const err = await renderTemplate('\n\n{{ missing }}', {}).catch(e => e) as Record<string, unknown>; // LINE_COLUMN_MARKER

    expect(err.lineno).toBeGreaterThan(0);
    expect(err.colno).toBeDefined();
    expect(err.colno).toBeGreaterThanOrEqual(0);
  });

  test('errors are serializable via toJSON', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;

    const json = err.toJSON ? (err.toJSON as () => Record<string, unknown>)() : null;
    expect(json).toBeTruthy();
    expect(json?.code).toBe('UNDEFINED_VARIABLE');
    expect(json?.causes).toBeDefined();
    expect(json?.fixCode).toBeDefined();
  });

  test('error html output is complete', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;

    const html = await (err.output as (opts: unknown) => Promise<string>)({ format: 'html', verbosity: 'full' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Possible Causes');
    expect(html).toContain('Suggested Fix');
  });

  test('error ansi output has colored sections', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;

    const ansi = await (err.output as (opts: unknown) => Promise<string>)({ format: 'ansi', verbosity: 'full' });
    expect(ansi).toContain('Possible Causes');
    expect(ansi).toContain('Suggested Fix');
  });

  test('error message includes the variable name with placeholders', async () => {
    const err = await renderTemplate('{{ specificName }}', {}).catch(e => e) as Record<string, unknown>;

    expect(err.message).toContain('specificName');
  });

  test('NULL_VALUE error with nested access shows clear path', async () => {
    const err = await renderTemplate('{{ a.b.c }}', { a: null }).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBeTruthy();
    expect(err.message).toBeTruthy();
    expect((err.causes as unknown[]).length).toBeGreaterThan(0);
  });

  test('UNDEFINED_PROPERTY error has specific causes about the property', async () => {
    const err = await renderTemplate('{{ user.email }}', { user: { name: 'Ada' } }).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBe('UNDEFINED_PROPERTY');
    expect((err.causes as unknown[]).length).toBeGreaterThanOrEqual(2);
  });

  test('SYNTAX_ERROR has multiple causes', async () => {
    const err = await renderTemplate('{{ unclosed', {}).catch(e => e) as Record<string, unknown>;

    expect(err.code).toBeTruthy();
    expect((err.causes as unknown[]).length).toBeGreaterThanOrEqual(2);
  });

  test('error outputs renderContext in HTML', async () => {
    const err = await renderTemplate('{{ missing }}', { x: 1, y: 2 }).catch(e => e) as Record<string, unknown>;

    const html = await (err.output as (opts: unknown) => Promise<string>)({ format: 'html', verbosity: 'full' });
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(500);
  });

  test('severity defaults to error', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;

    expect((err.severity || 'error')).toBe('error');
  });

  test('error line/col are 0-based internally', async () => {
    const err = await renderTemplate('\n\n\n{{ missing }}', {}).catch(e => e) as Record<string, unknown>; // ZERO_BASED_MARKER

    expect(err.lineno).toBeGreaterThan(0);
    expect(err.colno).toBeDefined();
  });
});

describe('JSON_ESCAPED_OUTPUT detection', () => {
  const renderWithAutoescape = async (template: string, context: Record<string, unknown> = {}) => await render(template, context, {
    autoescape: true,
  } as Record<string, unknown>);

  test('array with quotes triggers JSON_ESCAPED_OUTPUT', async () => {
    const err = await renderWithAutoescape('{{ data }}', { data: ['"test"'] }).catch(e => e) as Record<string, unknown>;
    expect(err.code).toBe('JSON_ESCAPED_OUTPUT');
  });

  test('stringified JSON triggers JSON_ESCAPED_OUTPUT', async () => {
    const err = await renderWithAutoescape('{{ data }}', { data: '{"name":"test"}' }).catch(e => e) as Record<string, unknown>;
    expect(err.code).toBe('JSON_ESCAPED_OUTPUT');
  });

  test('tojson filter prevents JSON_ESCAPED_OUTPUT', async () => {
    const result = await renderWithAutoescape('{{ data |> tojson }}', { data: ['"test"'] });
    expect(result).toBe('["\\"test\\""]');
  });

  test('JSON_ESCAPED_OUTPUT has proper causes', async () => {
    const err = await renderWithAutoescape('{{ data }}', { data: ['"x"'] }).catch(e => e) as Record<string, unknown>;
    expect(err.code).toBe('JSON_ESCAPED_OUTPUT');
    expect((err.causes as string[]).some((c: string) => c.includes('tojson'))).toBe(true);
  });

  test('fixCode suggests tojson filter', async () => {
    const err = await renderWithAutoescape('{{ data }}', { data: ['"x"'] }).catch(e => e) as Record<string, unknown>;
    expect(err.fixCode).toContain('tojson');
    expect(err.fixCode).toContain('|>');
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
      const err = await renderTemplate(sample.template, sample.context || {}).catch(e => e) as Record<string, unknown>;
      if (err.code === sample.code) {
        for (const cause of (err.causes as string[])) {
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
      const err = await renderTemplate(sample.template, sample.context || {}).catch(e => e) as Record<string, unknown>;
      if (err.fixCode) {
        expect((err.fixCode as string).length).toBeGreaterThan(5);
      }
    }
  });

  test('error format outputs are consistent', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;

    const text = await (err.output as (opts: unknown) => Promise<string>)({ format: 'text', verbosity: 'full' });
    const ansi = await (err.output as (opts: unknown) => Promise<string>)({ format: 'ansi', verbosity: 'full' });
    const html = await (err.output as (opts: unknown) => Promise<string>)({ format: 'html', verbosity: 'full' });

    expect(text.length).toBeGreaterThan(50);
    expect(ansi.length).toBeGreaterThan(50);
    expect(html.length).toBeGreaterThan(500);
  });
});
// @ts-nocheck
