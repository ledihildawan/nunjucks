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

describe('error layout consistency', () => {
  test('all sections use text-label class for consistency', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    const textLabels = html.match(/class="text-label"/g);
    expect(textLabels).toBeTruthy();
    expect(textLabels.length).toBeGreaterThanOrEqual(2);
  });

  test('text output includes sections in order', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const text = err.output({ format: 'text', verbosity: 'full' });

    expect(text.indexOf('Possible Causes:')).toBeLessThan(text.indexOf('Suggested Fix:'));
  });

  test('ansi output includes all sections with consistent format', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const ansi = err.output({ format: 'ansi', verbosity: 'full' });

    expect(ansi).toContain('Possible Causes:');
    expect(ansi).toContain('Suggested Fix:');
  });

  test('html structure has consistent section ordering', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    const causesIdx = html.indexOf('h-causes');
    const fixIdx = html.indexOf('h-fix');

    expect(causesIdx).toBeGreaterThan(-1);
    expect(fixIdx).toBeGreaterThan(causesIdx);
  });

  test('docs link appears inline in fix section when available', async () => {
    const { createLog, ERROR_DEFINITIONS } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.UNDEFINED_VARIABLE, { name: 'foo' }, 'foo', {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero'
    });
    const html = err.output({ format: 'html', verbosity: 'full' });

    expect(html).toContain('docs-inline');
    expect(html).toContain('templating.html#variables');
  });
});
