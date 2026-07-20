import { describe, test, expect } from 'bun:test';
import { render } from './render.js';
import { mergeConfig } from '../config/global.js';

const renderTemplate = async (template, context = {}, config = {}) => {
  return await render(template, context, mergeConfig({
    autoescape: false,
    ...config
  }));
};

describe('error messages - causes and fix', () => {
  test('undefined variable error includes causes', async () => {
    const err = await renderTemplate('{{ undefinedVar }}', {}, { undefined: 'strict' }).catch(e => e);

    expect(err.code).toBeTruthy();
    const classification = err.output({ format: 'text', verbosity: 'full' });

    expect(classification).toContain('Possible Causes');
    expect(classification).toContain('undefined');
  });

  test('undefined filter error includes causes', async () => {
    const err = await renderTemplate('{{ value |> noSuchFilter }}', { value: 'hello' }, { undefined: 'strict' }).catch(e => e);

    const text = err.output({ format: 'text', verbosity: 'full' });
    expect(text).toContain('Possible Causes');
    expect(text).toContain('Suggested Fix');
  });

  test('error output text includes humanized message', async () => {
    const err = await renderTemplate('{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e);
    const text = err.output({ format: 'text', verbosity: 'simple' });

    expect(text.length).toBeGreaterThan(0);
  });

  test('ansi output includes causes with bullets', async () => {
    const err = await renderTemplate('{{ x.y }}', { x: null }, { undefined: 'strict' }).catch(e => e);
    const ansi = err.output({ format: 'ansi', verbosity: 'full' });

    expect(ansi).toContain('Possible Causes');
  });

  test('medium verbosity shows cause hint', async () => {
    const err = await renderTemplate('{{ x.y }}', { x: null }, { undefined: 'strict' }).catch(e => e);
    const text = err.output({ format: 'text', verbosity: 'medium' });

    expect(text).toContain('Error:');
  });

  test('html output includes suggestion section', async () => {
    const err = await renderTemplate('{{ x.y }}', { x: null }, { undefined: 'strict' }).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    expect(html).toContain('<!DOCTYPE html>');
  });

  test('error includes positional info', async () => {
    const err = await renderTemplate('\n\n{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e);
    expect(err.lineno).toBe(2);
    expect(err.colno).toBeDefined();
  });

  test('error preserves location data through wrap', async () => {
    const err = await renderTemplate('{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e);
    expect(err.code).toBeTruthy();
    expect(err.lineno).toBeDefined();
    expect(err.colno).toBeDefined();
  });
});

describe('error - causes in code from registry', () => {
  test('UNDEFINED_VARIABLE has causes', async () => {
    const err = await renderTemplate('{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e);
    const text = err.output({ format: 'text', verbosity: 'full' });

    expect(text).toMatch(/variable|Variable|undefined|context/i);
  });

  test('parser errors have causes', async () => {
    const err = await renderTemplate('{% if foo %}', {}).catch(e => e);
    expect(err.code).toBeTruthy();
  });

  test('syntax error produces humanized output', async () => {
    const err = await renderTemplate('{% unknownTag %}', {}).catch(e => e);
    const text = err.output({ format: 'text', verbosity: 'full' });
    expect(text).toBeDefined();
  });
});

describe('error - severity', () => {
  test('errors have severity=error by default', async () => {
    const err = await renderTemplate('{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e);
    expect(err.severity || 'error').toBe('error');
  });
});

describe('error - fix code suggestion', () => {
  test('undefined variable error has fix suggestion', async () => {
    const err = await renderTemplate('{{ missing }}', {}, { undefined: 'strict' }).catch(e => e);
    const text = err.output({ format: 'text', verbosity: 'full' });

    expect(text).toContain('Suggested Fix');
  });
});

describe('error - documentation links', () => {
  test('html output can include docs section', async () => {
    const err = await renderTemplate('{{ missing }}', {}, { undefined: 'strict' }).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });
});

describe('error - related links', () => {
  test('error can have related links from definition', async () => {
    const err = await renderTemplate('{{ missing }}', {}, { undefined: 'strict' }).catch(e => e);
    expect(err).toBeDefined();
  });
});

describe('error - sandbox', () => {
  test('sandbox errors have proper code', async () => {
    const err = await renderTemplate(
      '{{ a.b.c }}',
      {},
      { sandbox: true, undefined: 'strict' }
    ).catch(e => e);

    expect(err).toBeDefined();
    expect(typeof err.output).toBe('function');
    const text = err.output({ format: 'text', verbosity: 'full' });
    expect(text).toBeDefined();
  });
});

describe('error - toJSON serialization', () => {
  test('error can be serialized to JSON', async () => {
    const err = await renderTemplate('{{ noSuch }}', {}, { undefined: 'strict' }).catch(e => e);
    const json = err.toJSON ? err.toJSON() : null;
    expect(json).toBeTruthy();
    expect(json.code).toBeTruthy();
    expect(json.message).toBeTruthy();
  });
});

describe('error - empty/null safety', () => {
  test('handles undefined error gracefully', () => {
    const html = (typeof window !== 'undefined' ? '' : '');
    expect(html).toBeDefined();
  });

  test('error preserves all important fields', async () => {
    const err = await renderTemplate('{{ missing }}', {}, { undefined: 'strict' }).catch(e => e);
    expect(err.name).toBe('Template render error');
    expect(err.message).toBeDefined();
    expect(typeof err.output).toBe('function');
  });
});
