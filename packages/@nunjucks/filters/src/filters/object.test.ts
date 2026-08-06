import { describe, test, expect } from 'bun:test';
import { render } from '@nunjucks/core';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}) =>
  await render(template, context, { autoescape: false });

describe('object filters', () => {
  describe('groupby', () => {
    test('groups items by attribute', async () => {
      const items = [
        { type: 'fruit', name: 'apple' },
        { type: 'fruit', name: 'banana' },
        { type: 'veg', name: 'carrot' },
      ];
      const result = await renderTemplate('{{ items |> groupby("type") |> length }}', { items });
      expect(result).toBe('2');
    });
  });
});
