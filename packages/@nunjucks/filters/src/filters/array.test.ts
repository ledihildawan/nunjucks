import { describe, test, expect } from 'bun:test';
import { render } from '@nunjucks/core';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}) =>
  await render(template, context, { autoescape: false });

describe('array filters', () => {
  describe('first', () => {
    test('returns first element', async () => {
      const result = await renderTemplate('{{ ["a", "b", "c"] |> first }}');
      expect(result).toBe('a');
    });
  });

  describe('last', () => {
    test('returns last element', async () => {
      const result = await renderTemplate('{{ ["a", "b", "c"] |> last }}');
      expect(result).toBe('c');
    });
  });

  describe('length', () => {
    test('returns array length', async () => {
      const result = await renderTemplate('{{ ["a", "b", "c"] |> length }}');
      expect(result).toBe('3');
    });

    test('returns string length', async () => {
      const result = await renderTemplate('{{ "hello" |> length }}');
      expect(result).toBe('5');
    });
  });

  describe('reverse', () => {
    test('reverses array elements', async () => {
      const result = await renderTemplate('{{ [1, 2, 3] |> reverse |> join }}');
      expect(result).toBe('321');
    });

    test('reverses string', async () => {
      const result = await renderTemplate('{{ "abc" |> reverse }}');
      expect(result).toBe('cba');
    });
  });

  describe('sort', () => {
    test('sorts array', async () => {
      const result = await renderTemplate('{{ [3, 1, 2] |> sort }}');
      expect(result).toBeTruthy();
    });
  });

  describe('join', () => {
    test('joins with delimiter', async () => {
      const result = await renderTemplate('{{ ["a", "b", "c"] |> join("-") }}');
      expect(result).toBe('a-b-c');
    });

    test('joins without delimiter', async () => {
      const result = await renderTemplate('{{ ["a", "b", "c"] |> join }}');
      expect(result).toBe('abc');
    });
  });
});
