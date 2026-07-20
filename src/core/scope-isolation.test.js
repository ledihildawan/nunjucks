import { describe, test, expect } from 'bun:test';
import { render } from './render.js';
import { mergeConfig } from '../config/global.js';

const renderTemplate = async (template, context = {}, config = {}) => {
  return await render(template, context, mergeConfig({
    autoescape: false,
    ...config
  }));
};

describe('scope isolation', () => {
  describe('if statement', () => {
    test('set inside if does not leak to parent', async () => {
      const result = await renderTemplate(
        '{{ x := 1 }}{% if true %}{{ x := 2 }}{% endif %}{{ x }}'
      );
      expect(result).toBe('1');
    });

    test('set inside else does not leak to parent', async () => {
      const result = await renderTemplate(
        '{{ x := 1 }}{% if false %}{{ x := 2 }}{% else %}{{ x := 3 }}{% endif %}{{ x }}'
      );
      expect(result).toBe('1');
    });

    test('nested if blocks are isolated from each other', async () => {
      const result = await renderTemplate(
        '{{ x := 1 }}{% if true %}{{ x := 2 }}{% if true %}{{ x := 3 }}{% endif %}{{ x }}{% endif %}{{ x }}'
      );
      expect(result).toBe('21');
    });
  });

  describe('for loop', () => {
    test('set inside for does not leak to parent', async () => {
      const result = await renderTemplate(
        '{{ x := 1 }}{% for i in [1, 2, 3] %}{{ x := i }}{% endfor %}{{ x }}'
      );
      expect(result).toBe('1');
    });

    test('loop variable is accessible inside loop', async () => {
      const result = await renderTemplate(
        '{% for i in [1, 2, 3] %}{{ i }}{% endfor %}'
      );
      expect(result).toBe('123');
    });

    test('loop variable does not leak after loop', async () => {
      const result = await renderTemplate(
        '{% for i in [1, 2, 3] %}{{ i }}{% endfor %}|'
      );
      expect(result).toBe('123|');
      expect(result).not.toContain('undefined');
    });
  });

  describe('combined if and for', () => {
    test('set inside nested if in for does not leak', async () => {
      const result = await renderTemplate(
        '{{ x := "initial" }}{% for i in [1, 2, 3] %}{% if i === 2 %}{{ x := "found" }}{% endif %}{% endfor %}{{ x }}'
      );
      expect(result).toBe('initial');
    });
  });

  describe('switch statement', () => {
    test('set inside case does not leak to parent', async () => {
      const result = await renderTemplate(
        '{{ x := 1 }}{% switch 2 %}{% case 1 %}{{ x := 10 }}{% endswitch %}{{ x }}'
      );
      expect(result).toBe('1');
    });

    test('set inside default case does not leak', async () => {
      const result = await renderTemplate(
        '{{ x := 1 }}{% switch 99 %}{% case 1 %}one{% default %}{{ x := 99 }}{% endswitch %}{{ x }}'
      );
      expect(result).toBe('1');
    });

    test('set inside different cases are isolated from each other', async () => {
      const result = await renderTemplate(
        '{% switch 1 %}{% case 1 %}{{ x := 10 }}{{ x }}{% case 2 %}{{ x := 20 }}{{ x }}{% endswitch %}'
      );
      expect(result).toBe('10');
    });

    test('set inside switch with nested if', async () => {
      const result = await renderTemplate(
        '{{ result := "original" }}{% switch 1 %}{% case 1 %}{% if true %}{{ result := "changed" }}{% endif %}{% endswitch %}{{ result }}'
      );
      expect(result).toBe('original');
    });
  });
});
