import { describe, expect, test } from 'bun:test';
import { getError } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createLog, formatError } from '@nunjucks/error-formatter';
import { renderTemplate as renderTemplateBase } from './render-test-helper.ts';

// WHY: every test asserts strict-mode error diagnostics, so the strict undefined mode is baked in file-wide.
const renderTemplate = (template: string, context: Record<string, unknown> = {}) =>
  renderTemplateBase(template, context, { undefined: 'strict' });

describe('error layout consistency', () => {
  test('all sections use text-label class for consistency', async () => {
    const err = (await renderTemplate('{{ missing }}', {}).catch((e) => e)) as TemplateError;
    const html = formatError(err, { format: 'html', verbosity: 'full', dev: true });

    const textLabels = html.match(/class="text-label"/g);
    expect(textLabels).toBeTruthy();
    expect(textLabels?.length).toBeGreaterThanOrEqual(2);
  });

  test('text output includes sections in order', async () => {
    const err = (await renderTemplate('{{ missing }}', {}).catch((e) => e)) as TemplateError;
    const text = formatError(err, { format: 'text', verbosity: 'full' });

    expect(text.indexOf('Possible Causes:')).toBeLessThan(text.indexOf('Suggested Fix:'));
  });

  test('ansi output includes all sections with consistent format', async () => {
    const err = (await renderTemplate('{{ missing }}', {}).catch((e) => e)) as TemplateError;
    const ansi = formatError(err, { format: 'ansi', verbosity: 'full' });

    expect(ansi).toContain('Possible Causes:');
    expect(ansi).toContain('Suggested Fix:');
  });

  test('html structure has consistent section ordering', async () => {
    const err = (await renderTemplate('{{ missing }}', {}).catch((e) => e)) as TemplateError;
    const html = formatError(err, { format: 'html', verbosity: 'full', dev: true });

    const causesIdx = html.indexOf('h-causes');
    const fixIdx = html.indexOf('h-fix');

    expect(causesIdx).toBeGreaterThan(-1);
    expect(fixIdx).toBeGreaterThan(causesIdx);
  });

  test('docs link appears inline in fix section when available', () => {
    const err = createLog('error', {
      def: getError('UNDEFINED_VARIABLE'),
      params: { name: 'foo' },
      subject: 'foo',
      context: {
        lineno: 1,
        colno: 0,
        phase: 'render',
        lineBase: 'zero' as const,
      },
    }) as TemplateError;
    const html = formatError(err, { format: 'html', verbosity: 'full', dev: true });

    expect(html).toContain('docs-inline');
    expect(html).toContain('templating.html#variables');
  });
});
