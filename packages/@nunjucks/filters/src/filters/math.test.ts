import { describe, test, expect } from 'bun:test';
import { render } from '@nunjucks/core';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}) =>
  await render(template, context, { autoescape: false });

describe('math filters', () => {
  describe('abs', () => {
    test('positive number unchanged', async () => {
      const result = await renderTemplate('{{ 5 |> abs }}');
      expect(result).toBe('5');
    });

    test('negative number becomes positive', async () => {
      const result = await renderTemplate('{{ -5 |> abs }}');
      expect(result).toBe('5');
    });

    test('zero stays zero', async () => {
      const result = await renderTemplate('{{ 0 |> abs }}');
      expect(result).toBe('0');
    });
  });

  describe('round', () => {
    test('rounds to integer by default', async () => {
      const result = await renderTemplate('{{ 3.7 |> round }}');
      expect(result).toBe('4');
    });

    test('rounds down correctly', async () => {
      const result = await renderTemplate('{{ 3.3 |> round }}');
      expect(result).toBe('3');
    });

    test('respects precision', async () => {
      const result = await renderTemplate('{{ 1.23456 |> round(2) }}');
      expect(result).toBe('1.23');
    });

    test('ceil method rounds up', async () => {
      const result = await renderTemplate('{{ 3.1 |> round(0, "ceil") }}');
      expect(result).toBe('4');
    });

    test('floor method rounds down', async () => {
      const result = await renderTemplate('{{ 3.9 |> round(0, "floor") }}');
      expect(result).toBe('3');
    });
  });
});
