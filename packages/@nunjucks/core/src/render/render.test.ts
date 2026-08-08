import { describe, test, expect } from 'bun:test';
import { render } from './render.ts';
import { isErr } from '@nunjucks/shared';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => {
  const result = await render(template, {
    context,
    autoescape: false,
    ...config
  });
  if (isErr(result)) { throw result.error; }
  return result.value;
};

describe('JavaScript expression smoke tests', () => {
  const renderExpr = async (template: string, context: Record<string, unknown> = {}) => {
    const result = await render(template, { context, autoescape: false });
    if (isErr(result)) { throw result.error; }
    return result.value;
  };

  test('JSON.stringify and JSON.parse work', async () => {
    const result = await renderExpr('{{ data |> tojson }}', { data: { a: 1, b: 'test' } });
    expect(result).toBe('{"a":1,"b":"test"}');
  });

  test('Math constants are available', async () => {
    expect(await renderExpr('{{ Math.PI }}')).toBe(String(Math.PI));
    expect(await renderExpr('{{ Math.E }}')).toBe(String(Math.E));
  });

  test('Math methods work in expressions', async () => {
    expect(await renderExpr('{{ Math.abs(-5) }}')).toBe('5');
    expect(await renderExpr('{{ Math.floor(4.7) }}')).toBe('4');
    expect(await renderExpr('{{ Math.ceil(4.1) }}')).toBe('5');
    expect(await renderExpr('{{ Math.round(4.5) }}')).toBe('5');
    expect(await renderExpr('{{ Math.sqrt(16) }}')).toBe('4');
    expect(await renderExpr('{{ Math.pow(2, 3) }}')).toBe('8');
    expect(await renderExpr('{{ Math.max(1, 5, 3) }}')).toBe('5');
    expect(await renderExpr('{{ Math.min(1, 5, 3) }}')).toBe('1');
  });

  test('Math.random works', async () => {
    const result = await renderExpr('{{ Math.random() }}');
    const num = Number.parseFloat(result);
    expect(num).toBeGreaterThanOrEqual(0);
    expect(num).toBeLessThan(1);
  });

  test('Object.keys, values, entries work', async () => {
    const data = { x: 1, y: 2 };
    expect(await renderExpr('{{ Object.keys(data) |> join(",") }}', { data })).toBe('x,y');
    expect(await renderExpr('{{ Object.values(data) |> join(",") }}', { data })).toBe('1,2');
  });

  test('Object methods work', async () => {
    const data = { a: 1, b: 2 };
    expect(await renderExpr('{{ Object.keys(data).length }}', { data })).toBe('2');
    expect(await renderExpr('{{ Object.values(data) |> join(",") }}', { data })).toBe('1,2');
    expect(await renderExpr('{{ Object.entries(data).length }}', { data })).toBe('2');
  });

  test('Array.isArray works', async () => {
    expect(await renderExpr('{{ Array.isArray(data) }}', { data: [1, 2, 3] })).toBe('true');
    expect(await renderExpr('{{ Array.isArray(data) }}', { data: { a: 1 } })).toBe('false');
    expect(await renderExpr('{{ Array.isArray(data) }}', { data: "string" })).toBe('false');
  });

  test('Number.isNaN and isFinite work', async () => {
    expect(await renderExpr('{{ Number.isNaN(0) }}')).toBe('false');
    expect(await renderExpr('{{ Number.isNaN(0 / 0) }}')).toBe('true');
    expect(await renderExpr('{{ Number.isFinite(5) }}')).toBe('true');
    expect(await renderExpr('{{ Number.isFinite(1 / 0) }}')).toBe('false');
  });

  test('Date.now works', async () => {
    const before = Date.now();
    const result = await renderExpr('{{ Date.now() }}');
    const after = Date.now();
    const timestamp = Number(result);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  test('ternary operator works', async () => {
    expect(await renderExpr('{{ "yes" if true else "no" }}')).toBe('yes');
    expect(await renderExpr('{{ "yes" if false else "no" }}')).toBe('no');
    expect(await renderExpr('{{ x > 5 ? "big" : "small" }}', { x: 10 })).toBe('big');
    expect(await renderExpr('{{ x > 5 ? "big" : "small" }}', { x: 3 })).toBe('small');
  });

  test('nullish coalescing works', async () => {
    expect(await renderExpr('{{ a ?? "default" }}', { a: null })).toBe('default');
    expect(await renderExpr('{{ a ?? "default" }}', { a: undefined })).toBe('default');
    expect(await renderExpr('{{ a ?? "default" }}', { a: 0 })).toBe('0');
    expect(await renderExpr('{{ a ?? "default" }}', { a: "" })).toBe('');
  });

  test('optional chaining works', async () => {
    const user = { profile: { name: 'Ada' } };
    expect(await renderExpr('{{ user?.profile?.name }}', { user })).toBe('Ada');
    expect(await renderExpr('{{ user?.missing?.name }}', { user })).toBe('');
    expect(await renderExpr('{{ null?.name }}')).toBe('');
  });

  test('complex expressions work', async () => {
    const items = [1, 2, 3, 4, 5];
    expect(await renderExpr('{{ items |> sum }}', { items })).toBe('15');
    expect(await renderExpr('{{ items |> length }}', { items })).toBe('5');
    expect(await renderExpr('{{ items |> reverse |> join(",") }}', { items })).toBe('5,4,3,2,1');
  });

  test('string expressions work', async () => {
    expect(await renderExpr('{{ "hello" |> upper }}')).toBe('HELLO');
    expect(await renderExpr('{{ "WORLD" |> lower }}')).toBe('world');
    expect(await renderExpr('{{ "hello" |> capitalize }}')).toBe('Hello');
  });

  test('arithmetic expressions work', async () => {
    expect(await renderExpr('{{ 10 + 5 }}')).toBe('15');
    expect(await renderExpr('{{ 10 - 3 }}')).toBe('7');
    expect(await renderExpr('{{ 4 * 3 }}')).toBe('12');
    expect(await renderExpr('{{ 15 / 3 }}')).toBe('5');
    expect(await renderExpr('{{ 17 % 5 }}')).toBe('2');
    expect(await renderExpr('{{ 2 ** 4 }}')).toBe('16');
    expect(await renderExpr('{{ 10 // 3 }}')).toBe('3');
  });
});

describe('template source security scanning', () => {
  test('flags dangerous code in an inline template under strictMode', async () => {
    const err = await renderTemplate("{{ eval('x') }}", {}, { strictMode: true }).catch(e => e);
    expect(err.code).toBe('DANGEROUS_TEMPLATE_CODE');
  });

  test('flags dangerous code in a file-loaded template under strictMode', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'njk-sec-'));
    await writeFile(join(dir, 'evil.njk'), "{{ eval('malicious') }}");
    try {
      const err = await renderTemplate('evil.njk', {}, { strictMode: true, views: dir } as Record<string, unknown>).catch(e => e);
      expect(err.code).toBe('DANGEROUS_TEMPLATE_CODE');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('dompurify per-render isolation', () => {
  test('dompurify config does not leak across renders', async () => {
    const r1 = await renderTemplate('{{ x |> sanitize }}', { x: '<b>bold</b><i>italic</i>' }, { dompurify: { ALLOWED_TAGS: ['b'] } } as Record<string, unknown>);
    expect(r1).toContain('bold');
    expect(r1).not.toContain('<i>');

    const r2 = await renderTemplate('{{ x |> sanitize }}', { x: '<b>bold</b><i>italic</i>' });
    expect(r2).toContain('<i>italic</i>');
  });
});
