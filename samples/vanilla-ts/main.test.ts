import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nunjucks } from '@nunjucks/core';
import { isOk } from '@nunjucks/lib';

// WHY: smoke test mirroring main.ts's engine setup — guards that every shipped view keeps
// rendering against the globals/filters contract the demo documents (main.ts itself is a
// top-level-await console demo, so importing it here would execute the demo).
const viewsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'views');

const njk = nunjucks({
  views: viewsDir,
  globals: {
    appName: 'Nunjucks App',
    greet: ({ name, greeting }: { name: string; greeting: string }) => `${greeting}, ${name}!`,
  },
  filters: {
    formatDate: (
      date: Date,
      { format = 'long', locale = 'en-US' }: { format?: string; locale?: string }
    ) =>
      new Intl.DateTimeFormat(locale, { dateStyle: format === 'long' ? 'long' : 'short' }).format(
        date
      ),
  },
});

describe('vanilla-ts sample smoke', () => {
  test('hello.njk renders the context name', async () => {
    const result = await njk.render('hello.njk', { name: 'World' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toContain('World');
    }
  });

  test('inline template resolves the appName global and version builtin', async () => {
    const result = await njk.render('{{ appName }} v{{ version }}');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toContain('Nunjucks App v');
    }
  });

  test('greet.njk renders through the greet global', async () => {
    const result = await njk.render('greet.njk');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toContain('Welcome, World!');
    }
  });

  test('kwargs.njk renders through the formatDate filter with keyword args', async () => {
    const result = await njk.render('kwargs.njk', { date: new Date('2026-08-16T00:00:00Z') });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toContain('Date: ');
    }
  });

  test('destruct.njk computes via the walrus destructure', async () => {
    const result = await njk.render('destruct.njk');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toContain('Result: 1 + 2 = 3');
    }
  });

  test('pipe-demo.njk pipes through builtin filters', async () => {
    const result = await njk.render('pipe-demo.njk', { name: 'Nunjucks' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toContain('NUNJUCKS - 8');
    }
  });
});
