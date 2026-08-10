import { describe, test, expect } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nunjucks } from './nunjucks.ts';

describe('nunjucks factory', () => {
  test('render returns the rendered template with context', async () => {
    const njk = nunjucks({});
    const result = await njk.render('Hello {{ name }}!', { name: 'World' });
    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    expect(result.value).toBe('Hello World!');
  });

  test('factory bakes in filters and globals — no per-call passing needed', async () => {
    const njk = nunjucks({
      filters: { shout: (value: string) => String(value).toUpperCase() },
      globals: { appName: 'Demo' },
    });
    const result = await njk.render('{{ appName }}: {{ name |> shout }}', { name: 'hi' });
    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    expect(result.value).toBe('Demo: HI');
  });

  test('plugin filters layer below user filters (user wins same-name)', async () => {
    const njk = nunjucks({
      plugins: [{ name: 'greeter', filters: { greet: () => 'plugin' } }],
      filters: { greet: () => 'user' },
    });
    const result = await njk.render('{{ x |> greet }}', { x: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    expect(result.value).toBe('user');
  });

  test('absent config groups do not clobber engine defaults (compact spreads)', async () => {
    // WHY: regression for the undefined-spread bug — without compact(), an absent security group would set
    // sandbox: undefined and override the default false, accidentally enabling sandbox mode.
    const njk = nunjucks({});
    const result = await njk.render('{{ a + b }}', { a: 1, b: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    expect(result.value).toBe('3');
  });

  test('nested security config flattens to blockedContextKeys', async () => {
    // WHY: passing the blocked key IN the context is rejected wholesale (BLOCKED_CONTEXT_KEYS) — that rejection
    // proves the nested security.blockedContextKeys was flattened into the internal config. The positive case
    // (blocked key absent) renders normally, confirming the flatten does not break ordinary rendering.
    const njk = nunjucks({ security: { blockedContextKeys: ['secret'] } });
    const blocked = await njk.render('{{ safe }}', { safe: 'ok', secret: 'hidden' });
    expect(blocked.ok).toBe(false);

    const clean = await njk.render('{{ safe }}', { safe: 'ok' });
    expect(clean.ok).toBe(true);
    if (!clean.ok) { return; }
    expect(clean.value).toBe('ok');
  });

  test('renderToStream yields the streamed output', async () => {
    const njk = nunjucks({});
    const result = await njk.renderToStream('Hi {{ n }}', { n: 'there' });
    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    const chunks: string[] = [];
    for await (const chunk of result.stream) { chunks.push(chunk); }
    expect(chunks.join('')).toBe('Hi there');
  });

  test('factory-owned loader resolves file templates from views', async () => {
    // WHY: proves the factory creates and uses its OWN loader for the configured views path (not the
    // module-global cache).
    const viewsDir = path.join(tmpdir(), `njk-factory-${Date.now()}`);
    await mkdir(viewsDir, { recursive: true });
    await writeFile(path.join(viewsDir, 'greet.njk'), 'Hello {{ name }}!');
    try {
      const njk = nunjucks({ views: viewsDir });
      const result = await njk.render('greet.njk', { name: 'File' });
      expect(result.ok).toBe(true);
      if (!result.ok) { return; }
      expect(result.value).toBe('Hello File!');
    } finally {
      await rm(viewsDir, { recursive: true, force: true });
    }
  });

  test('factory-supplied filters with reserved names are rejected by validation', async () => {
    // WHY: the factory maps filters → customFilters so the existing per-render validateConfig fires and
    // rejects a filter name that shadows a reserved keyword (e.g. `if`).
    const njk = nunjucks({ filters: { if: () => 'x' } });
    const result = await njk.render('{{ x |> if }}', { x: 'y' });
    expect(result.ok).toBe(false);
  });
});
