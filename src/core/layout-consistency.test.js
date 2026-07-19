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
  test('tip section uses insight-section class matching existing layout', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    expect(html).toContain('class="insight-section"');
    expect(html).toMatch(/<section class="insight-section" aria-labelledby="h-suggestion">/);
    expect(html).toMatch(/<section class="insight-section" aria-labelledby="h-docs">/);
  });

  test('all sections use text-label class for consistency', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    const textLabels = html.match(/class="text-label"/g);
    expect(textLabels).toBeTruthy();
    expect(textLabels.length).toBeGreaterThanOrEqual(4);
  });

  test('docs links are styled as badges/pills', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    expect(html).toContain('class="docs-link"');
    expect(html).toContain('class="docs-list"');
  });

  test('text output includes all sections in order', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const text = err.output({ format: 'text', verbosity: 'full' });

    expect(text.indexOf('Possible Causes:')).toBeLessThan(text.indexOf('Suggested Fix:'));
    expect(text.indexOf('Suggested Fix:')).toBeLessThan(text.indexOf('💡 Tip:'));
    expect(text.indexOf('💡 Tip:')).toBeLessThan(text.indexOf('Learn More:'));
  });

  test('ansi output includes all sections with consistent format', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const ansi = err.output({ format: 'ansi', verbosity: 'full' });

    expect(ansi).toContain('Possible Causes:');
    expect(ansi).toContain('Suggested Fix:');
    expect(ansi).toContain('💡 Tip:');
    expect(ansi).toContain('Learn More:');
  });

  test('html structure has consistent section ordering', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    const causesIdx = html.indexOf('h-causes');
    const fixIdx = html.indexOf('h-fix');
    const suggestionIdx = html.indexOf('h-suggestion');
    const docsIdx = html.indexOf('h-docs');

    expect(causesIdx).toBeGreaterThan(-1);
    expect(fixIdx).toBeGreaterThan(causesIdx);
    expect(suggestionIdx).toBeGreaterThan(fixIdx);
    expect(docsIdx).toBeGreaterThan(suggestionIdx);
  });
});
