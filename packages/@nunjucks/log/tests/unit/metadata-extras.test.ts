import { describe, expect, test } from 'bun:test';
import { createLog } from '../../src/create-log.ts';
import { ERROR_DEFINITIONS } from '../../src/error/messages.ts';
import { getErrorMetadata, formatSnippet } from '../../src/error/metadata-extras.ts';
import { normalizeErrorMetadata } from '../../src/error/normalize.ts';

const buildError = (overrides = {}) => {
  const errorLike = new Error('Variable \'missing\' is not defined');
  Object.assign(errorLike, {
    code: 'UNDEFINED_VARIABLE',
    subject: 'missing',
    message: "Variable 'missing' is not defined",
    phase: 'render',
    templateName: 'C:/app/page.njk',
    templatePath: 'C:/app/page.njk',
    sourceContent: 'Line one\n{{ missing }}\nLine three',
    sourceStartLine: 1,
    lineno: 0,
    colno: 3,
    lineBase: 'zero'
  });
  Object.assign(errorLike, overrides);
  return normalizeErrorMetadata(errorLike, { templateName: 'C:/app/page.njk' }).error;
};

describe('getErrorMetadata', () => {
  test('returns 1-based display coordinates when lineBase is zero', () => {
    const meta = getErrorMetadata(buildError());
    expect(meta.lineno).toBe(0);
    expect(meta.colno).toBe(3);
    expect(meta.displayLine).toBe(1);
    expect(meta.displayCol).toBe(4);
    expect(meta.lineBase).toBe('zero');
  });

  test('keeps raw coordinates when lineBase is one', () => {
    const meta = getErrorMetadata(buildError({ lineno: 4, colno: 2, lineBase: 'one' }));
    expect(meta.displayLine).toBe(4);
    expect(meta.displayCol).toBe(2);
  });

  test('builds a snippet with the error line marked', () => {
    const meta = getErrorMetadata(buildError({ lineno: 1 }));
    expect(meta.snippet).toContain('{{ missing }}');
    expect(meta.snippetLines).toHaveLength(3);
    expect(meta.snippetLines[1]?.isError).toBe(true);
  });

  test('honors snippetContext window', () => {
    const source = Array.from({ length: 20 }, (_, i) => `L${i}`).join('\n');
    const meta = getErrorMetadata(buildError({ sourceContent: source, sourceStartLine: 1, lineno: 9 }), { snippetContext: 1 });
    expect(meta.snippetLines).toHaveLength(3);
    expect(meta.snippetLines[0]?.number).toBe(8);
    expect(meta.snippetLines[1]?.isError).toBe(true);
    expect(meta.snippetLines[1]?.number).toBe(9);
  });

  test('returns null snippet when sourceContent is missing', () => {
    const meta = getErrorMetadata(buildError({ sourceContent: null, lineno: null, colno: null }));
    expect(meta.snippet).toBeNull();
    expect(meta.caret).toBeNull();
  });

  test('skips source when includeSource is false', () => {
    const meta = getErrorMetadata(buildError(), { includeSource: false });
    expect(meta.sourceContent).toBeNull();
    expect(meta.snippet).toBeNull();
    expect(meta.code).toBe('UNDEFINED_VARIABLE');
  });

  test('skips render context when includeRenderContext is false', () => {
    const err = buildError();
    (err as unknown as { renderContext: unknown }).renderContext = { user: { name: 'Ada' } };
    const meta = getErrorMetadata(err, { includeRenderContext: false });
    expect(meta.renderContext).toBeNull();
  });

  test('does not throw on frozen or sealed errors', () => {
    const err = buildError();
    expect(() => getErrorMetadata(Object.freeze(err))).not.toThrow();
    expect(() => getErrorMetadata(Object.seal(err))).not.toThrow();
  });

  test('omits caret when displayCol is zero or missing', () => {
    const meta = getErrorMetadata(buildError({ colno: null }));
    expect(meta.caret).toBeNull();
  });
});

describe('formatSnippet', () => {
  test('returns the snippet string', () => {
    const err = buildError();
    expect(formatSnippet(err)).toBe(getErrorMetadata(err).snippet);
    expect(formatSnippet(err)).toContain('{{ missing }}');
  });

  test('returns null for errors without source content', () => {
    expect(formatSnippet(buildError({ sourceContent: null, lineno: null }))).toBeNull();
  });
});

describe('TemplateError.toJSON', () => {
  test('round-trips a stable, loggable shape', () => {
    const err = buildError({ output: undefined });
    const json = JSON.parse(JSON.stringify(err));
    expect(json.code).toBe('UNDEFINED_VARIABLE');
    expect(json.subject).toBe('missing');
    expect(json.templateName).toBe('C:/app/page.njk');
    expect(json.templatePath).toBe('C:/app/page.njk');
    expect(json.lineno).toBe(0);
    expect(json.colno).toBe(3);
    expect(json.lineBase).toBe('zero');
    expect(json.sourceStartLine).toBe(1);
    expect('output' in json).toBe(false);
    expect('renderContext' in json).toBe(false);
  });
});
