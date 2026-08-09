import { describe, expect, test } from 'bun:test';
import { extractTemplatePosition, extractQuotedSubjectPosition, extractBareSubjectPosition } from './error-location-matching.ts';

describe('extractTemplatePosition', () => {
  test('returns null when the template is absent from the content', () => {
    expect(extractTemplatePosition({ content: 'const x = 1;', template: 'not present anywhere', errLineno: 0, errColno: 0, subject: 'nope', preferredLine: null })).toBeNull();
  });

  test('returns null when template is null and no subject is given', () => {
    expect(extractTemplatePosition({ content: 'const x = 1;', template: null, errLineno: 0, errColno: 0, subject: null, preferredLine: null })).toBeNull();
  });

  test('locates a template literal inside the caller source', () => {
    const content = 'const html = render(`Hello {{ name }}`, ctx);';
    const pos = extractTemplatePosition({ content, template: 'Hello {{ name }}', errLineno: 0, errColno: 8, subject: null, preferredLine: null });
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(1);
    expect(pos?.col).toBeGreaterThan(10);
  });

  test('honours preferredLine to disambiguate multiple occurrences', () => {
    const content = "render('x', {});\nrender('x', {});\nrender('x', {});";
    const first = extractTemplatePosition({ content, template: 'x', errLineno: 0, errColno: 0, subject: null, preferredLine: 1 });
    const third = extractTemplatePosition({ content, template: 'x', errLineno: 0, errColno: 0, subject: null, preferredLine: 3 });
    expect(first).not.toBeNull();
    expect(third).not.toBeNull();
    expect((third?.line ?? 0)).toBeGreaterThan((first?.line ?? 0));
  });

  test('computes a deterministic position for an inline template', () => {
    expect(extractTemplatePosition({ content: 'a {{ x }} b', template: '{{ x }}', errLineno: 0, errColno: 3, subject: null, preferredLine: null })).toEqual({ line: 1, col: 6 });
  });

  test('BLOCKED_CONTEXT_KEYS: locates {{ subject }} instead of [subject] when template matches the pattern', () => {
    const content = "const html = await render('{{ password }}', { password: 'secret123' }, { blockedContextKeys: ['password'] });";
    const pos = extractTemplatePosition({ content, template: '{{ password }}', errLineno: null, errColno: null, subject: 'password', preferredLine: 1 });
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(1);
    const colInLine = content.indexOf('{{ password }}') + '{{ '.length;
    expect(pos?.col).toBe(colInLine + 1);
  });
});

describe('extractQuotedSubjectPosition', () => {
  test('returns null when the subject is absent from the content', () => {
    expect(extractQuotedSubjectPosition({ content: 'const x = 1;', template: 'not present', errLineno: 0, errColno: 0, subject: 'nope', preferredLine: null })).toBeNull();
  });

  test('finds a quoted property key but ignores bare keyword occurrences', () => {
    const wrapperContent = "import { render } from '@nunjucks/core';\nconst renderTemplate = async (template, context, options) => {\n  const result = await render(template, { context, ...options });\n  if (isErr(result)) { throw result.error; }\n  return result.value;\n};";
    const pos = extractQuotedSubjectPosition({ content: wrapperContent, template: '{{ value }}', errLineno: 0, errColno: 0, subject: 'if', preferredLine: 4 });
    expect(pos).toBeNull();
  });

  test('locates a single-quoted subject key in consumer config', () => {
    const consumerContent = "router.get('/test', async (_req, res) => {\n  const html = await renderTemplate('{{ value }}', { value: 'test' }, { dev: true, customFilters: { 'if': (v) => v } });\n  res.type('html').send(html);\n});";
    const pos = extractQuotedSubjectPosition({ content: consumerContent, template: '{{ value }}', errLineno: 0, errColno: 0, subject: 'if', preferredLine: 2 });
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(2);
  });
});

describe('extractBareSubjectPosition', () => {
  test('returns null when the subject is absent from the content', () => {
    expect(extractBareSubjectPosition({ content: 'const x = 1;', template: 'not present', errLineno: 0, errColno: 0, subject: 'nope', preferredLine: null })).toBeNull();
  });

  test('locates a bare subject token when the template is not found', () => {
    const content = "const html = render('{{ missingVar }}', ctx); // uses missingVar";
    const pos = extractBareSubjectPosition({ content, template: 'totally different', errLineno: 0, errColno: 0, subject: 'missingVar', preferredLine: null });
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(1);
  });
});
