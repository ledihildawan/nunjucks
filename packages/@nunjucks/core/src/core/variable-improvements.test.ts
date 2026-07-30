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

describe('compound assignment operators', () => {
  test('+= adds, reassigns, and outputs the new value', async () => {
    await expect(renderTemplate('{{ x += 3 }}', { x: 5 })).resolves.toBe('8');
  });

  test('-= subtracts and outputs the new value', async () => {
    await expect(renderTemplate('{{ x -= 2 }}', { x: 10 })).resolves.toBe('8');
  });

  test('*= multiplies and outputs the new value', async () => {
    await expect(renderTemplate('{{ x *= 3 }}', { x: 4 })).resolves.toBe('12');
  });

  test('/= divides and outputs the new value', async () => {
    await expect(renderTemplate('{{ x /= 2 }}', { x: 8 })).resolves.toBe('4');
  });

  test('%= modulos and outputs the new value', async () => {
    await expect(renderTemplate('{{ x %= 3 }}', { x: 7 })).resolves.toBe('1');
  });

  test('**= exponentiates and outputs the new value', async () => {
    await expect(renderTemplate('{{ x **= 3 }}', { x: 2 })).resolves.toBe('8');
  });

  test('//= floor-divides and outputs the new value', async () => {
    await expect(renderTemplate('{{ x //= 2 }}', { x: 7 })).resolves.toBe('3');
  });

  test('||= keeps a truthy value unchanged', async () => {
    await expect(renderTemplate('{{ x ||= 9 }}', { x: 5 })).resolves.toBe('5');
  });

  test('||= assigns when falsy', async () => {
    await expect(renderTemplate('{{ x ||= 9 }}', { x: 0 })).resolves.toBe('9');
  });

  test('&&= assigns the RHS when truthy', async () => {
    await expect(renderTemplate('{{ x &&= 9 }}', { x: 5 })).resolves.toBe('9');
  });

  test('??= assigns when nullish', async () => {
    await expect(renderTemplate('{{ x ??= 9 }}', { x: null })).resolves.toBe('9');
  });

  test('side effects persist across subsequent outputs', async () => {
    await expect(renderTemplate('{{ (x := 5) }}{{ (x += 3) }}{{ (x *= 2) }}{{ x }}'))
      .resolves.toBe('581616');
  });
});
