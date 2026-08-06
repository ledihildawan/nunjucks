import { describe, expect, test } from 'bun:test';
import { extractCallerPosition } from './error-location-matching.ts';

describe('extractCallerPosition', () => {
  test('returns null when nothing can be located', () => {
    expect(extractCallerPosition('const x = 1;', 'not present anywhere', 0, 0, 'nope', null)).toBeNull();
    expect(extractCallerPosition('const x = 1;', null, 0, 0, null, null)).toBeNull();
  });

  test('locates a template literal inside the caller source', () => {
    const content = 'const html = render(`Hello {{ name }}`, ctx);';
    const pos = extractCallerPosition(content, 'Hello {{ name }}', 0, 8, null, null);
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(1);
    // Column should point near the 'n' of 'name' within the caller line.
    expect(pos?.col).toBeGreaterThan(10);
  });

  test('locates a subject token when the template is not found', () => {
    const content = "const html = render('{{ missingVar }}', ctx); // uses missingVar";
    const pos = extractCallerPosition(content, 'totally different', 0, 0, 'missingVar', null);
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(1);
  });

  test('honours preferredLine to disambiguate multiple occurrences', () => {
    const content = "render('x', {});\nrender('x', {});\nrender('x', {});";
    const first = extractCallerPosition(content, 'x', 0, 0, null, 1);
    const third = extractCallerPosition(content, 'x', 0, 0, null, 3);
    expect(first).not.toBeNull();
    expect(third).not.toBeNull();
    expect((third?.line ?? 0)).toBeGreaterThan((first?.line ?? 0));
  });

  test('computes a deterministic position for an inline template', () => {
    // content: 'a {{ x }} b' — template '{{ x }}' at offset 2; error col 3 (the 'x').
    // matchOffset(2) + col(3) = 5 → 1-based { line: 1, col: 6 }.
    expect(extractCallerPosition('a {{ x }} b', '{{ x }}', 0, 3, null, null)).toEqual({ line: 1, col: 6 });
  });

  test('BLOCKED_CONTEXT_KEYS: locates {{ subject }} instead of [subject] when template matches the pattern', () => {
    // Simulates BLOCKED_CONTEXT_KEYS where template is the inline '{{ password }}'
    // but subject also appears in ['password'] (the blocked keys array).
    // The fix should prefer the {{ subject }} location, not the array element,
    // and the column should point at the subject token itself (after `{{ `).
    const content = "const html = await render('{{ password }}', { password: 'secret123' }, { blockedContextKeys: ['password'] });";
    const pos = extractCallerPosition(content, '{{ password }}', null, null, 'password', 1);
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(1);
    const colInLine = content.indexOf('{{ password }}') + '{{ '.length;
    expect(pos?.col).toBe(colInLine + 1);
  });
});
