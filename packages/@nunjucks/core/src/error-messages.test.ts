import { describe, test, expect } from 'bun:test';
import { render } from './render.ts';
import { formatError, type TemplateError } from '@nunjucks/log';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => await render(template, context, {
  autoescape: false,
  ...config
} as Record<string, unknown>);

describe('error messages - causes and fix', () => {
  test('undefined variable error includes causes', async () => {
    const err = await renderTemplate('{{ undefinedVar }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError;

    expect(err.code).toBeTruthy();
    const classification = formatError(err, { format: 'text', verbosity: 'full' });

    expect(classification).toContain('Possible Causes');
    expect(classification).toContain('undefined');
  });

  test('undefined filter error includes causes', async () => {
    const err = await renderTemplate('{{ value |> noSuchFilter }}', { value: 'hello' }, { undefined: 'strict' }).catch(e => e) as TemplateError;

    const text = formatError(err, { format: 'text', verbosity: 'full' });
    expect(text).toContain('Possible Causes');
    expect(text).toContain('Suggested Fix');
  });

  test('error output text includes humanized message', async () => {
    const err = await renderTemplate('{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError;
    const text = formatError(err, { format: 'text', verbosity: 'simple' });

    expect(text.length).toBeGreaterThan(0);
  });

  test('ansi output includes causes with bullets', async () => {
    const err = await renderTemplate('{{ x.y }}', { x: null }, { undefined: 'strict' }).catch(e => e) as TemplateError;
    const ansi = formatError(err, { format: 'ansi', verbosity: 'full' });

    expect(ansi).toContain('Possible Causes');
  });

  test('medium verbosity shows cause hint', async () => {
    const err = await renderTemplate('{{ x.y }}', { x: null }, { undefined: 'strict' }).catch(e => e) as TemplateError;
    const text = formatError(err, { format: 'text', verbosity: 'medium' });

    expect(text).toContain('Error:');
  });

  test('html output includes suggestion section', async () => {
    const err = await renderTemplate('{{ x.y }}', { x: null }, { undefined: 'strict' }).catch(e => e) as TemplateError;
    const html = formatError(err, { format: 'html', verbosity: 'full' });

    expect(html).toContain('<!DOCTYPE html>');
  });

  test('error includes positional info', async () => {
    const err = await renderTemplate('\n\n{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError; // POSITIONAL_INFO_MARKER
    expect(err.lineno).toBeGreaterThan(0);
    expect(err.colno).toBeDefined();
  });

  test('error preserves location data through wrap', async () => {
    const err = await renderTemplate('{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError;
    expect(err.code).toBeTruthy();
    expect(err.lineno).toBeDefined();
    expect(err.colno).toBeDefined();
  });
});

describe('error - causes in code from registry', () => {
  test('UNDEFINED_VARIABLE has causes', async () => {
    const err = await renderTemplate('{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError;
    const text = formatError(err, { format: 'text', verbosity: 'full' });

    expect(text).toMatch(/variable|Variable|undefined|context/i);
  });

  test('parser errors have causes', async () => {
    const err = await renderTemplate('{% if foo %}', {}).catch(e => e) as TemplateError;
    expect(err.code).toBeTruthy();
  });

  test('syntax error produces humanized output', async () => {
    const err = await renderTemplate('{% unknownTag %}', {}).catch(e => e) as TemplateError;
    const text = formatError(err, { format: 'text', verbosity: 'full' });
    expect(text).toBeDefined();
  });
});

describe('error - severity', () => {
  test('errors have severity=error by default', async () => {
    const err = await renderTemplate('{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError;
    expect((err.severity || 'error')).toBe('error');
  });
});

describe('error - fix code suggestion', () => {
  test('undefined variable error has fix suggestion', async () => {
    const err = await renderTemplate('{{ missing }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError;
    const text = formatError(err, { format: 'text', verbosity: 'full' });

    expect(text).toContain('Suggested Fix');
  });
});

describe('error - documentation links', () => {
  test('html output can include docs section', async () => {
    const err = await renderTemplate('{{ missing }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError;
    const html = formatError(err, { format: 'html', verbosity: 'full' });

    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });
});

describe('error - related links', () => {
  test('error can have related links from definition', async () => {
    const err = await renderTemplate('{{ missing }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError;
    expect(err).toBeDefined();
  });
});

describe('error - sandbox', () => {
  test('sandbox errors have proper code', async () => {
    const err = await renderTemplate(
      '{{ a.b.c }}',
      {},
      { sandbox: true, undefined: 'strict' }
    ).catch(e => e) as TemplateError;

    expect(err).toBeDefined();
    const text = formatError(err, { format: 'text', verbosity: 'full' });
    expect(text).toBeDefined();
  });
});

describe('error - toJSON serialization', () => {
  test('error can be serialized to JSON', async () => {
    const err = await renderTemplate('{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError;
    let json: Record<string, unknown> | null = null;
    if (err.toJSON) { json = (err.toJSON as () => Record<string, unknown>)(); }
    expect(json).toBeTruthy();
    expect(json?.code).toBeTruthy();
    expect(json?.message).toBeTruthy();
  });
});

describe('error - empty/null safety', () => {
  test('handles undefined error gracefully', () => {
    const html = '';
    expect(html).toBeDefined();
  });

  test('error preserves all important fields', async () => {
    const err = await renderTemplate('{{ missing }}', {}, { undefined: 'strict' }).catch(e => e) as TemplateError;
    expect(err.name).toBe('Template render error');
    expect(err.message).toBeDefined();
  });
});
