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
  test('more-info section uses unified class', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    expect(html).toContain('class="more-info-section"');
    expect(html).toMatch(/<section class="more-info-section" aria-labelledby="h-more-info">/);
  });

  test('all sections use text-label class for consistency', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    const textLabels = html.match(/class="text-label"/g);
    expect(textLabels).toBeTruthy();
    expect(textLabels.length).toBeGreaterThanOrEqual(3);
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
    expect(text.indexOf('Suggested Fix:')).toBeLessThan(text.indexOf('💡 More Info:'));
  });

  test('ansi output includes all sections with consistent format', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const ansi = err.output({ format: 'ansi', verbosity: 'full' });

    expect(ansi).toContain('Possible Causes:');
    expect(ansi).toContain('Suggested Fix:');
    expect(ansi).toContain('💡 More Info:');
  });

  test('html structure has consistent section ordering', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    const causesIdx = html.indexOf('h-causes');
    const fixIdx = html.indexOf('h-fix');
    const moreInfoIdx = html.indexOf('h-more-info');

    expect(causesIdx).toBeGreaterThan(-1);
    expect(fixIdx).toBeGreaterThan(causesIdx);
    expect(moreInfoIdx).toBeGreaterThan(fixIdx);
  });

  test('tip and docs are combined in single section', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e);
    const html = err.output({ format: 'html', verbosity: 'full' });

    const sectionMatches = html.match(/<section class="more-info-section"/g) || [];
    expect(sectionMatches.length).toBe(1);

    const insightSectionCount = (html.match(/insight-section/g) || []).length;
    expect(insightSectionCount).toBe(0);
  });
});
