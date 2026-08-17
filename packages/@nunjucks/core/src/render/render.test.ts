import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isErr, isOk } from '@nunjucks/lib';
import { render, renderToStream } from './render.ts';
import { renderTemplate } from './render-test-helper.ts';

describe('JavaScript expression smoke tests', () => {
  const renderExpr = async (template: string, context: Record<string, unknown> = {}) => {
    const result = await render(template, { context, autoescape: false });
    if (isErr(result)) {
      throw result.error;
    }
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
    expect(await renderExpr('{{ Array.isArray(data) }}', { data: 'string' })).toBe('false');
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
    expect(await renderExpr('{{ a ?? "default" }}', { a: '' })).toBe('');
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
    const err = await renderTemplate("{{ eval('x') }}", {}, { strictMode: true }).catch((e) => e);
    expect(err.code).toBe('DANGEROUS_TEMPLATE_CODE');
  });

  test('flags dangerous code in a file-loaded template under strictMode', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'njk-sec-'));
    await writeFile(join(dir, 'evil.njk'), "{{ eval('malicious') }}");
    try {
      const err = await renderTemplate('evil.njk', {}, { strictMode: true, views: dir } as Record<
        string,
        unknown
      >).catch((e) => e);
      expect(err.code).toBe('DANGEROUS_TEMPLATE_CODE');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('dompurify per-render isolation', () => {
  test('dompurify config does not leak across renders', async () => {
    const firstRenderResult = await renderTemplate('{{ x |> sanitize }}', { x: '<b>bold</b><i>italic</i>' }, {
      dompurify: { ALLOWED_TAGS: ['b'] },
    } as Record<string, unknown>);
    expect(firstRenderResult).toContain('bold');
    expect(firstRenderResult).not.toContain('<i>');

    const secondRenderResult = await renderTemplate('{{ x |> sanitize }}', { x: '<b>bold</b><i>italic</i>' });
    expect(secondRenderResult).toContain('<i>italic</i>');
  });
});

describe('render edge cases', () => {
  test('empty template returns empty string', async () => {
    const result = await renderTemplate('', {});
    expect(result).toBe('');
  });

  test('unicode context values render correctly', async () => {
    const result = await renderTemplate('{{ x }}', { x: '日本語' });
    expect(result).toContain('日本語');
  });

  test('whitespace-only template preserves whitespace', async () => {
    const result = await renderTemplate('   ', {});
    expect(result).toBe('   ');
  });
});

describe('execution deadline', () => {
  test('blocking render honors executionTimeout for chunk-yielding loops', async () => {
    const indexes = Array.from({ length: 500000 }, (_, index) => index);
    const result = await render('{% for index in indexes %}{{ index }}{% endfor %}', {
      context: { indexes },
      executionTimeout: 1,
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('TIMEOUT');
    }
  }, 30000);

  test('disabled deadline (0) renders to completion', async () => {
    const indexes = Array.from({ length: 1000 }, (_, index) => index);
    const result = await render('{% for index in indexes %}{{ index }}{% endfor %}', {
      context: { indexes },
      executionTimeout: 0,
    });
    expect(isOk(result)).toBe(true);
  });
});

describe('config misuse regression', () => {
  test('render with a non-function filter returns err, not a crash', async () => {
    const result = await render('Hello {{ name }}', {
      context: { name: 'World' },
      filters: { notAFn: 42 },
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('INVALID_CONFIG');
      expect(result.error.message).toContain('notAFn');
    }
  });

  test('render with a non-function test returns err', async () => {
    const result = await render('Hello', { tests: { notATest: 'nope' } });
    expect(isErr(result)).toBe(true);
  });

  test('renderToStream result works with isOk/isErr helpers', async () => {
    const okResult = await renderToStream('Hello {{ name }}', { context: { name: 'Stream' } });
    expect(isOk(okResult)).toBe(true);
    const errResult = await renderToStream('{{ unclosed', {});
    expect(isErr(errResult)).toBe(true);
    if (isErr(errResult)) {
      expect(errResult.error).toBeDefined();
    }
  });
});
