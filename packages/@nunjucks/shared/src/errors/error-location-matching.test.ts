import { describe, expect, test } from 'bun:test';
import { extractCallerPosition } from './error-location-matching.ts';

describe('extractCallerPosition', () => {
  test('returns null when nothing can be located', () => {
    expect(extractCallerPosition({ content: 'const x = 1;', template: 'not present anywhere', errLineno: 0, errColno: 0, subject: 'nope', preferredLine: null })).toBeNull();
    expect(extractCallerPosition({ content: 'const x = 1;', template: null, errLineno: 0, errColno: 0, subject: null, preferredLine: null })).toBeNull();
  });

  test('locates a template literal inside the caller source', () => {
    const content = 'const html = render(`Hello {{ name }}`, ctx);';
    const pos = extractCallerPosition({ content, template: 'Hello {{ name }}', errLineno: 0, errColno: 8, subject: null, preferredLine: null });
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(1);
    expect(pos?.col).toBeGreaterThan(10);
  });

  test('locates a subject token when the template is not found', () => {
    const content = "const html = render('{{ missingVar }}', ctx); // uses missingVar";
    const pos = extractCallerPosition({ content, template: 'totally different', errLineno: 0, errColno: 0, subject: 'missingVar', preferredLine: null });
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(1);
  });

  test('honours preferredLine to disambiguate multiple occurrences', () => {
    const content = "render('x', {});\nrender('x', {});\nrender('x', {});";
    const first = extractCallerPosition({ content, template: 'x', errLineno: 0, errColno: 0, subject: null, preferredLine: 1 });
    const third = extractCallerPosition({ content, template: 'x', errLineno: 0, errColno: 0, subject: null, preferredLine: 3 });
    expect(first).not.toBeNull();
    expect(third).not.toBeNull();
    expect((third?.line ?? 0)).toBeGreaterThan((first?.line ?? 0));
  });

  test('computes a deterministic position for an inline template', () => {
    expect(extractCallerPosition({ content: 'a {{ x }} b', template: '{{ x }}', errLineno: 0, errColno: 3, subject: null, preferredLine: null })).toEqual({ line: 1, col: 6 });
  });

  test('BLOCKED_CONTEXT_KEYS: locates {{ subject }} instead of [subject] when template matches the pattern', () => {
    const content = "const html = await render('{{ password }}', { password: 'secret123' }, { blockedContextKeys: ['password'] });";
    const pos = extractCallerPosition({ content, template: '{{ password }}', errLineno: null, errColno: null, subject: 'password', preferredLine: 1 });
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(1);
    const colInLine = content.indexOf('{{ password }}') + '{{ '.length;
    expect(pos?.col).toBe(colInLine + 1);
  });
});
