import { describe, test, expect } from 'bun:test';
import { render } from '@nunjucks/core';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}) =>
  await render(template, context, { autoescape: false });

describe('string filters', () => {
  describe('default', () => {
    test('returns default for null', async () => {
      const result = await renderTemplate('{{ value |> default("def") }}', { value: null });
      expect(result).toBe('def');
    });

    test('returns default for undefined', async () => {
      const result = await renderTemplate('{{ value |> default("def") }}', { value: undefined });
      expect(result).toBe('def');
    });

    test('returns value when truthy', async () => {
      const result = await renderTemplate('{{ value |> default("def") }}', { value: 'hello' });
      expect(result).toBe('hello');
    });
  });

  describe('capitalize', () => {
    test('capitalizes first letter', async () => {
      const result = await renderTemplate('{{ "hello" |> capitalize }}');
      expect(result).toBe('Hello');
    });

    test('lowercase rest', async () => {
      const result = await renderTemplate('{{ "HELLO" |> capitalize }}');
      expect(result).toBe('Hello');
    });
  });

  describe('upper / lower', () => {
    test('upper converts to uppercase', async () => {
      const result = await renderTemplate('{{ "hello" |> upper }}');
      expect(result).toBe('HELLO');
    });

    test('lower converts to lowercase', async () => {
      const result = await renderTemplate('{{ "HELLO" |> lower }}');
      expect(result).toBe('hello');
    });
  });

  describe('escape', () => {
    test('escape converts html chars', async () => {
      const result = await renderTemplate('{{ "<script>" |> escape }}');
      expect(result).toContain('&lt;');
    });
  });

  describe('truncate', () => {
    test('short string unchanged', async () => {
      const result = await renderTemplate('{{ "hi" |> truncate(10) }}');
      expect(result).toBe('hi');
    });

    test('truncates long string with ellipsis', async () => {
      const result = await renderTemplate('{{ "hello world foo bar" |> truncate(11) }}');
      expect(result).toContain('...');
    });

    test('killwords cuts at length', async () => {
      const result = await renderTemplate('{{ "hello world" |> truncate(5, true) }}');
      expect(result).toContain('hello');
    });
  });

  describe('trim', () => {
    test('removes leading/trailing whitespace', async () => {
      const result = await renderTemplate('{{ "  hello  " |> trim }}');
      expect(result).toBe('hello');
    });
  });

  describe('title', () => {
    test('capitalizes each word', async () => {
      const result = await renderTemplate('{{ "hello world foo" |> title }}');
      expect(result).toBe('Hello World Foo');
    });
  });

  describe('join', () => {
    test('joins with delimiter', async () => {
      const result = await renderTemplate('{{ ["a", "b", "c"] |> join("-") }}');
      expect(result).toBe('a-b-c');
    });

    test('default empty delimiter', async () => {
      const result = await renderTemplate('{{ ["a", "b", "c"] |> join }}');
      expect(result).toBe('abc');
    });
  });

  describe('replace', () => {
    test('replaces all occurrences', async () => {
      const result = await renderTemplate('{{ "a-b-c" |> replace("-", "+") }}');
      expect(result).toBe('a+b+c');
    });
  });

  describe('urlencode', () => {
    test('encodes string', async () => {
      const result = await renderTemplate('{{ "hello world" |> urlencode }}');
      expect(result).toBe('hello%20world');
    });
  });

  describe('indent', () => {
    test('indents each line', async () => {
      const result = await renderTemplate('{{ "hello\nworld" |> indent(2) }}');
      expect(result).toContain('hello');
    });
  });
});
