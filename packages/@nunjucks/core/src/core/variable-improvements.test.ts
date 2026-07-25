import { describe, expect, test } from 'bun:test';
import { render } from './render.ts';

const renderTemplate = (template: string, context: Record<string, unknown> = {}) => render(template, context, {
  autoescape: false,
  undefined: 'strict'
} as Record<string, unknown>);

describe('variable expression edge cases', () => {
  test('supports array destructuring walrus targets', async () => {
    await expect(renderTemplate(
      '{% if ([a, b] := pair) %}{{ a }}-{{ b }}{% endif %}',
      { pair: [3, 4] }
    )).resolves.toBe('3-4');
  });

  test('supports object destructuring walrus targets', async () => {
    await expect(renderTemplate(
      '{% if ({a, b} := value) %}{{ a }}-{{ b }}{% endif %}',
      { value: { a: 5, b: 6 } }
    )).resolves.toBe('5-6');
  });

  test('supports nested walrus expressions', async () => {
    await expect(renderTemplate('{{ (a := (b := 2)) }}{{ a }}-{{ b }}')).resolves.toBe('22-2');
  });

  test('supports walrus expressions inside arrays', async () => {
    await expect(renderTemplate('{{ [(x := 1), (y := 2)] }}{{ x }}-{{ y }}')).resolves.toBe('1,21-2');
  });

  test('supports prefix and postfix increment/decrement', async () => {
    await expect(renderTemplate('{{ ++x }}-{{ x++ }}-{{ --x }}-{{ x-- }}', { x: 2 }))
      .resolves.toBe('3-3-3-3');
  });
});
