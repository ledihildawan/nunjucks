import { describe, test, expect } from 'bun:test';
import { render } from './render.ts';
import { mergeConfig } from '../config/global.ts';
import { createLog, getError } from '@nunjucks/log';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => {
  return await render(template, context, mergeConfig({
    autoescape: false,
    undefined: 'strict',
    ...config
  }) as unknown as Record<string, unknown>);
};

describe('error layout consistency', () => {
  test('all sections use text-label class for consistency', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;
    const html = await (err.output as (opts: unknown) => Promise<string>)({ format: 'html', verbosity: 'full' });

    const textLabels = html.match(/class="text-label"/g);
    expect(textLabels).toBeTruthy();
    expect(textLabels?.length).toBeGreaterThanOrEqual(2);
  });

  test('text output includes sections in order', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;
    const text = await (err.output as (opts: unknown) => Promise<string>)({ format: 'text', verbosity: 'full' });

    expect(text.indexOf('Possible Causes:')).toBeLessThan(text.indexOf('Suggested Fix:'));
  });

  test('ansi output includes all sections with consistent format', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;
    const ansi = await (err.output as (opts: unknown) => Promise<string>)({ format: 'ansi', verbosity: 'full' });

    expect(ansi).toContain('Possible Causes:');
    expect(ansi).toContain('Suggested Fix:');
  });

  test('html structure has consistent section ordering', async () => {
    const err = await renderTemplate('{{ missing }}', {}).catch(e => e) as Record<string, unknown>;
    const html = await (err.output as (opts: unknown) => Promise<string>)({ format: 'html', verbosity: 'full' });

    const causesIdx = html.indexOf('h-causes');
    const fixIdx = html.indexOf('h-fix');

    expect(causesIdx).toBeGreaterThan(-1);
    expect(fixIdx).toBeGreaterThan(causesIdx);
  });

  test('docs link appears inline in fix section when available', async () => {
    const err = createLog('error', getError('UNDEFINED_VARIABLE'), { name: 'foo' }, 'foo', {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero' as const
    });
    const html = await err.output({ format: 'html', verbosity: 'full' });

    expect(html).toContain('docs-inline');
    expect(html).toContain('templating.html#variables');
  });
});
