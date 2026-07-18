import { describe, expect, test } from 'bun:test';
import { renderContextHtml } from './sections.ts';

const extractContextJson = (html: string): unknown => {
  const match = html.match(/<script type="application\/json" id="ctx-data">([\s\S]*?)<\/script>/);
  expect(match).not.toBeNull();
  return JSON.parse(match?.[1] ?? '{}');
};

describe('renderContextHtml', () => {
  test('emits parseable inert JSON for render context values', () => {
    const html = renderContextHtml({
      title: '</script><script>alert(1)</script>',
      count: 3,
      enabled: true,
      missing: undefined,
      helper: function formatPrice() {},
      createdAt: new Date('2026-07-19T00:00:00.000Z')
    });

    expect(html).toContain('type="application/json" id="ctx-data"');
    expect(html).not.toContain('data-ctx-action="expand"');
    expect(html).not.toContain('data-ctx-action="collapse"');
    expect(html).toContain('data-ctx-action="copy"');
    expect(html).not.toContain('</script><script>alert(1)</script>');

    expect(extractContextJson(html)).toEqual({
      title: '</script><script>alert(1)</script>',
      count: 3,
      enabled: true,
      missing: '[Undefined]',
      helper: '[Function: formatPrice]',
      createdAt: '2026-07-19T00:00:00.000Z'
    });
  });

  test('shows state-aware expand controls for nested data', () => {
    const html = renderContextHtml({ user: { name: 'Ada' } });

    expect(html).toContain('data-ctx-action="expand"');
    expect(html).toContain('data-ctx-action="collapse" disabled');
    expect(html).toContain('data-ctx-action="copy"');
  });

  test('returns no render-context controls for empty visible data', () => {
    expect(renderContextHtml({ __nunjucksInternal: true, globalThis: true })).toBe('');
  });

  test('filters private and blocked keys while preserving safe nested data', () => {
    const html = renderContextHtml({
      user: {
        name: 'Ada',
        eval: 'allowed as nested data'
      },
      globalThis: 'blocked at top level',
      __nunjucksInternal: 'hidden'
    });

    expect(extractContextJson(html)).toEqual({
      user: {
        name: 'Ada',
        eval: 'allowed as nested data'
      }
    });
  });

  test('serializes circular values without throwing', () => {
    const user: Record<string, unknown> = { name: 'Ada' };
    user.profile = user;

    const html = renderContextHtml({ user });

    expect(extractContextJson(html)).toEqual({
      user: {
        name: 'Ada',
        profile: '[Circular]'
      }
    });
  });
});
