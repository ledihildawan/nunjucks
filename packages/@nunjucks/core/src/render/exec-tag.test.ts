import { describe, expect, test } from 'bun:test';
import { renderTemplate } from './render-test-helper.ts';

describe('exec tag', () => {
  test('executes function without producing output', async () => {
    const items: string[] = [];
    const result = await renderTemplate('{% exec items.push("hello") %}done', { items });
    expect(result).toBe('done');
    expect(items).toEqual(['hello']);
  });

  test('executes multiple exec statements', async () => {
    const items: string[] = [];
    const result = await renderTemplate(
      '{% exec items.push("a") %}{% exec items.push("b") %}{% exec items.push("c") %}{{ items.join(",") }}',
      { items }
    );
    expect(result).toBe('a,b,c');
  });

  test('exec with function call side effect', async () => {
    const result = await renderTemplate('{% exec log.push("counted") %}{{ log[0] }}', {
      log: [] as string[],
    });
    expect(result).toBe('counted');
  });

  test('exec inside for loop', async () => {
    const items: number[] = [];
    const result = await renderTemplate(
      '{% for i in [1, 2, 3] %}{% exec items.push(i * 10) %}{% endfor %}{{ items.join(",") }}',
      { items }
    );
    expect(result).toBe('10,20,30');
  });

  test('exec inside if block', async () => {
    const items: string[] = [];
    const result = await renderTemplate(
      '{% if true %}{% exec items.push("yes") %}{% endif %}{{ items[0] }}',
      { items }
    );
    expect(result).toBe('yes');
  });

  test('exec with complex expression', async () => {
    const log: string[] = [];
    const result = await renderTemplate('{% exec log.push("msg: " + "test") %}{{ log[0] }}', {
      log,
    });
    expect(result).toBe('msg: test');
  });

  test('exec does not affect template output', async () => {
    const result = await renderTemplate('before{% exec null %}after');
    expect(result).toBe('beforeafter');
  });
});
