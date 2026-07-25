import { describe, test, expect } from 'bun:test';
import { render } from './render.ts';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => await render(template, context, {
  autoescape: false,
  ...config
} as Record<string, unknown>);

describe('do tag', () => {
  test('executes function without producing output', async () => {
    const items: string[] = [];
    const result = await renderTemplate(
      '{% do items.push("hello") %}done',
      { items }
    );
    expect(result).toBe('done');
    expect(items).toEqual(['hello']);
  });

  test('executes multiple do statements', async () => {
    const items: string[] = [];
    const result = await renderTemplate(
      '{% do items.push("a") %}{% do items.push("b") %}{% do items.push("c") %}{{ items.join(",") }}',
      { items }
    );
    expect(result).toBe('a,b,c');
  });

  test('do with function call side effect', async () => {
    const result = await renderTemplate(
      '{% do log.push("counted") %}{{ log[0] }}',
      { log: [] as string[] }
    );
    expect(result).toBe('counted');
  });

  test('do inside for loop', async () => {
    const items: number[] = [];
    const result = await renderTemplate(
      '{% for i in [1, 2, 3] %}{% do items.push(i * 10) %}{% endfor %}{{ items.join(",") }}',
      { items }
    );
    expect(result).toBe('10,20,30');
  });

  test('do inside if block', async () => {
    const items: string[] = [];
    const result = await renderTemplate(
      '{% if true %}{% do items.push("yes") %}{% endif %}{{ items[0] }}',
      { items }
    );
    expect(result).toBe('yes');
  });

  test('do with complex expression', async () => {
    const log: string[] = [];
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
