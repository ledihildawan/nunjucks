import { describe, test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { render } from './render.ts';
import { formatError } from '@nunjucks/log';
import { isErr } from '@nunjucks/shared';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => {
  const result = await render(template, context, { ...config });
  if (isErr(result)) { throw result.error; }
  return result.value;
};

let currentTestSourceCache: { filePath: string; sourceContent: string; sourceLines: string[] } | null = null;

const getCurrentTestSource = async () => {
  if (currentTestSourceCache) {
    return currentTestSourceCache;
  }

  const filePath = fileURLToPath(import.meta.url);
  const sourceContent = await readFile(filePath, 'utf8');
  currentTestSourceCache = {
    filePath,
    sourceContent,
    sourceLines: sourceContent.split('\n')
  };
  return currentTestSourceCache;
};

describe('inline template error location pointing', () => {
  test('points at the failing template token inside the caller source line', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "INLINE_LOCATION_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate('{{ missingKey }}', {}, {
      dev: true,
      undefined: 'strict',
      jsCaller: filePath,
      jsCallerErrorLine: markerLine,
      jsCallerErrorCol: 1
    }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('missingKey') + 1);
  });

  test('automatically uses the real caller file for inline template locations', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const cfg = { dev: true, undefined: 'strict' } as unknown as Partial<Record<string, unknown>>;
    const err = await renderTemplate('{{ product.name }}', { product: { test: 'test' } }, cfg).catch(e => e);

    expect(err.lineBase).toBe('one');
    expect(err.templatePath).toBe(filePath);
    expect(err.templateName).toBe(filePath);
    const expectedLine = source.findIndex(line => line.includes("renderTemplate('{{ product.name }}'")) + 1;
    expect(expectedLine).toBeGreaterThan(0);
    expect(err.lineno).toBe(expectedLine);
    const callerLine = source[err.lineno - 1] ?? '';
    expect(err.colno).toBe(callerLine.indexOf('product.name') + 'product.'.length + 1);
  });

  test('points at the failing template token inside a multiline caller template literal', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "MULTILINE_INLINE_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate(`

      {{ missingKey }}

      `, {}, {
      dev: true,
      undefined: 'strict',
      jsCaller: filePath,
      jsCallerErrorLine: markerLine + 1,
      jsCallerErrorCol: 1
    }).catch(e => e);
    const expectedLine = source.findIndex((line, idx) => idx + 1 > markerLine && line.includes('{{ missingKey }}')) + 1;
    const callerLine = source[expectedLine - 1] ?? '';

    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.lineno).toBe(expectedLine);
    expect(err.colno).toBe(callerLine.indexOf('missingKey') + 1);
  });

  test('points reserved filter errors at the filter key in caller config', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "RESERVED_FILTER_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate('{{ value }}', { value: 'test' }, { dev: true, filters: { 'if': (v: unknown) => v }, _customFilters: { 'if': (v: unknown) => v }, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.code).toBe('RESERVED_KEYWORD');
    expect(err.subject).toBe('if');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf("'if'") + 2);
  });

  test('renders reserved filter caret under the filter key in html output', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "RESERVED_FILTER_HTML_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate('{{ value }}', { value: 'test' }, { dev: true, filters: { 'if': (v: unknown) => v }, _customFilters: { 'if': (v: unknown) => v }, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';
    const html = formatError(err, { format: 'html', verbosity: 'full' });
    const markerMatch = html.match(/error-marker-content">([^<]*\^+)<\/span>/u);

    expect(markerMatch).not.toBeNull();
    expect(markerMatch?.[1]).toBe(`${' '.repeat(callerLine.indexOf("'if'") + 1)}^^`);
  });

  test('auto caller detection points reserved filter errors at the filter key', async () => {
    const cfg = { dev: true, filters: { 'if': (v: unknown) => v } } as unknown as Partial<Record<string, unknown>>;
    const result = await renderTemplate('{{ value }}', { value: 'test' }, cfg);
    expect(result).toBe('test');
  });

  test('points non-string template errors at the invalid template argument', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "NON_STRING_TEMPLATE_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate(123 as unknown as string, {}, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.code).toBe('TEMPLATE_MUST_BE_STRING');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('123') + 1);
    expect(callerLine.slice(err.colno - 1, err.colno + 2)).toBe('123');
  });

  test('points null template errors at the null literal argument', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "NULL_TEMPLATE_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate(null as unknown as string, {}, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.code).toBe('TEMPLATE_MUST_BE_STRING');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('null') + 1);
    expect(callerLine.slice(err.colno - 1, err.colno + 3)).toBe('null');
  });

  test('points invalid config errors at the failing config key', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "INVALID_CONFIG_LOCATION_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate('{{ test }}', { test: 'value' }, { dev: true, executionTimeout: -1, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.code).toBe('INVALID_CONFIG');
    expect(err.subject).toBe('executionTimeout');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('executionTimeout') + 1);
  });

  test('points undefined member lookups at the missing property', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "MISSING_PROPERTY_LOCATION_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate('{{ product.name }}', { product: { test: 'test' } }, { dev: true, undefined: 'strict', jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.code).toBe('UNDEFINED_PROPERTY');
    expect(err.subject).toBe('name');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('product.name') + 'product.'.length + 1);
  });

  test('points slice errors inside statements at the slice step', async () => {
    const { filePath, sourceLines: source } = await getCurrentTestSource();
    const marker = "STATEMENT_SLICE_LOCATION_MARKER";
    const markerLine = source.findIndex(line => line.includes(marker)) + 1;
    const err = await renderTemplate('{% if items[::0] %}ok{% endif %}', { items: [1, 2, 3] }, { dev: true, jsCaller: filePath, jsCallerErrorLine: markerLine, jsCallerErrorCol: 1 }).catch(e => e);
    const callerLine = source[err.lineno - 1] ?? '';

    expect(err.code).toBe('SLICE_STEP');
    expect(err.lineBase).toBe('one');
    expect(err.templateName).toBe(filePath);
    expect(err.colno).toBe(callerLine.indexOf('::0') + 3);
  });

  test('renders slice steps with omitted bounds', async () => {
    await expect(renderTemplate('{{ items[::2] }}', { items: [0, 1, 2, 3, 4] }))
      .resolves.toBe('0,2,4');
    await expect(renderTemplate('{{ items[1::2] }}', { items: [0, 1, 2, 3, 4] }))
      .resolves.toBe('1,3');
  });
});
