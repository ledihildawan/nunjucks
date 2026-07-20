import { describe, test, expect } from 'bun:test';
import { render } from './render.js';
import { mergeConfig } from '../config/global.js';

const renderTemplate = async (template, context = {}, config = {}) => {
  return await render(template, context, mergeConfig({
    autoescape: false,
    ...config
  }));
};

describe('do tag', () => {
  test('executes function without producing output', async () => {
    const items = [];
    const result = await renderTemplate(
      '{% do items.push("hello") %}done',
      { items }
    );
    expect(result).toBe('done');
    expect(items).toEqual(['hello']);
  });

  test('executes multiple do statements', async () => {
    const items = [];
    const result = await renderTemplate(
      '{% do items.push("a") %}{% do items.push("b") %}{% do items.push("c") %}{{ items.join(",") }}',
      { items }
    );
    expect(result).toBe('a,b,c');
  });

  test('do with function call side effect', async () => {
    const result = await renderTemplate(
      '{% do log.push("counted") %}{{ log[0] }}',
      { log: [] }
    );
    expect(result).toBe('counted');
  });

  test('do inside for loop', async () => {
    const items = [];
    const result = await renderTemplate(
      '{% for i in [1, 2, 3] %}{% do items.push(i * 10) %}{% endfor %}{{ items.join(",") }}',
      { items }
    );
    expect(result).toBe('10,20,30');
  });

  test('do inside if block', async () => {
    const items = [];
    const result = await renderTemplate(
      '{% if true %}{% do items.push("yes") %}{% endif %}{{ items[0] }}',
      { items }
    );
    expect(result).toBe('yes');
  });

  test('do with complex expression', async () => {
    const log = [];
    const result = await renderTemplate(
      '{% do log.push("msg: " + "test") %}{{ log[0] }}',
      { log }
    );
    expect(result).toBe('msg: test');
  });

  test('do does not affect template output', async () => {
    const result = await renderTemplate(
      'before{% do null %}after'
    );
    expect(result).toBe('beforeafter');
  });
});
