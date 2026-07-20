import { describe, test, expect } from 'bun:test';
import { render } from './render.js';
import { mergeConfig } from '../config/global.js';

const renderTemplate = async (template, context = {}, config = {}) => {
  return await render(template, context, mergeConfig({
    autoescape: false,
    ...config
  }));
};

describe('with tag', () => {
  test('creates isolated scope', async () => {
    const result = await renderTemplate(
      '{% set x = 1 %}{% with %}{% set x = 2 %}{% endwith %}{{ x }}'
    );
    expect(result).toBe('1');
  });

  test('variable set inside with does not leak', async () => {
    const result = await renderTemplate(
      '{% with %}{% set inside = "yes" %}{% endwith %}{{ inside }}'
    );
    expect(result).not.toContain('yes');
  });

  test('can read parent variables inside with', async () => {
    const result = await renderTemplate(
      '{% set x = "parent" %}{% with %}{{ x }}{% endwith %}'
    );
    expect(result).toBe('parent');
  });

  test('nested with blocks are isolated', async () => {
    const result = await renderTemplate(
      '{% set x = 0 %}{% with %}{% set x = 1 %}{% with %}{% set x = 2 %}{% endwith %}{{ x }}{% endwith %}{{ x }}'
    );
    expect(result).toBe('10');
  });

  test('with inside for loop', async () => {
    const result = await renderTemplate(
      '{% for i in [1, 2] %}{% with %}{% set x = i * 10 %}{{ x }}{% endwith %}{% endfor %}'
    );
    expect(result).toBe('1020');
  });

  test('with preserves original variable', async () => {
    const result = await renderTemplate(
      '{% set msg = "original" %}{% with %}{% set msg = "changed" %}{% endwith %}{{ msg }}'
    );
    expect(result).toBe('original');
  });

  test('multiple variables inside with are isolated', async () => {
    const result = await renderTemplate(
      '{% with %}{% set a = 1 %}{% set b = 2 %}{{ a + b }}{% endwith %}'
    );
    expect(result).toBe('3');
  });
});
