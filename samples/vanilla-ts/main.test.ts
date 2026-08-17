import { describe, expect, test } from 'bun:test';
import { nunjucks } from '@nunjucks/core';
import { isOk } from '@nunjucks/lib';
import { engineConfig } from './engine-config.ts';

// WHY: smoke test sharing main.ts's engine config — guards that every shipped view keeps
// rendering against the globals/filters contract the demo documents (main.ts itself is a
// top-level-await console demo, so importing it here would execute the demo).
const njk = nunjucks(engineConfig);

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
      expect(result.value).toMatch(/Date: August 1[56], 2026/);
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
