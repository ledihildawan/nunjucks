import { describe, test, expect } from 'bun:test';
import { render } from './render.js';
import { mergeConfig } from '../config/global.js';

const renderTemplate = async (template, context = {}, config = {}) => {
  return await render(template, context, mergeConfig({
    autoescape: false,
    ...config
  }));
};

describe('with tag', () => {
  describe('set inside with (Form 1)', () => {
    test('creates isolated scope', async () => {
      const result = await renderTemplate(
        '{% set x = 1 %}{% with %}{% set x = 2 %}{% endwith %}{{ x }}'
      );
      expect(result).toBe('1');
    });

    test('variable set inside with does not leak', async () => {
      const result = await renderTemplate(
        '{% with %}{% set inside = "yes" %}{% endwith %}{{ inside }}'
      );
      expect(result).not.toContain('yes');
    });

    test('can read parent variables inside with', async () => {
      const result = await renderTemplate(
        '{% set x = "parent" %}{% with %}{{ x }}{% endwith %}'
      );
      expect(result).toBe('parent');
    });

    test('nested with blocks are isolated', async () => {
      const result = await renderTemplate(
        '{% set x = 0 %}{% with %}{% set x = 1 %}{% with %}{% set x = 2 %}{% endwith %}{{ x }}{% endwith %}{{ x }}'
      );
      expect(result).toBe('10');
    });

    test('with inside for loop', async () => {
      const result = await renderTemplate(
        '{% for i in [1, 2] %}{% with %}{% set x = i * 10 %}{{ x }}{% endwith %}{% endfor %}'
      );
      expect(result).toBe('1020');
    });

    test('with preserves original variable', async () => {
      const result = await renderTemplate(
        '{% set msg = "original" %}{% with %}{% set msg = "changed" %}{% endwith %}{{ msg }}'
      );
      expect(result).toBe('original');
    });

    test('multiple variables inside with are isolated', async () => {
      const result = await renderTemplate(
        '{% with %}{% set a = 1 %}{% set b = 2 %}{{ a + b }}{% endwith %}'
      );
      expect(result).toBe('3');
    });
  });

  describe('inline assignments (Form 2: Jinja2-style)', () => {
    test('single inline assignment', async () => {
      const result = await renderTemplate(
        '{% with x = 42 %}{{ x }}{% endwith %}'
      );
      expect(result).toBe('42');
    });

    test('multiple inline assignments', async () => {
      const result = await renderTemplate(
        '{% with x = 1, y = 2 %}{{ x + y }}{% endwith %}'
      );
      expect(result).toBe('3');
    });

    test('inline assignment with expression', async () => {
      const result = await renderTemplate(
        '{% with total = items.length %}{{ total }}{% endwith %}',
        { items: [1, 2, 3] }
      );
      expect(result).toBe('3');
    });

    test('inline assignment with function call', async () => {
      const result = await renderTemplate(
        '{% with greeting = greet("World") %}{{ greeting }}{% endwith %}',
        { greet: (name) => `Hello ${name}` }
      );
      expect(result).toBe('Hello World');
    });

    test('inline assignment does not leak to parent', async () => {
      const result = await renderTemplate(
        '{% with x = 42 %}{% endwith %}{{ x }}'
      );
      expect(result).toBe('undefined');
    });

    test('inline assignment can read parent variables', async () => {
      const result = await renderTemplate(
        '{% set base = 10 %}{% with x = base * 2 %}{{ x }}{% endwith %}'
      );
      expect(result).toBe('20');
    });

    test('nested inline assignments are isolated', async () => {
      const result = await renderTemplate(
        '{% with x = 1 %}{% with x = 2 %}{{ x }}{% endwith %}{{ x }}{% endwith %}'
      );
      expect(result).toBe('21');
    });

    test('inline and set inside can coexist', async () => {
      const result = await renderTemplate(
        '{% with x = 1 %}{% set y = 2 %}{{ x + y }}{% endwith %}'
      );
      expect(result).toBe('3');
    });

    test('inline assignment with arithmetic expression', async () => {
      const result = await renderTemplate(
        '{% with a = 3, b = 4, c = a * b %}{{ c }}{% endwith %}'
      );
      expect(result).toBe('12');
    });

    test('inline assignment with string concatenation', async () => {
      const result = await renderTemplate(
        '{% with first = "Hello", second = "World" %}{{ first + " " + second }}{% endwith %}'
      );
      expect(result).toBe('Hello World');
    });
  });

  describe('edge cases', () => {
    test('empty with block', async () => {
      const result = await renderTemplate(
        'before{% with %}{% endwith %}after'
      );
      expect(result).toBe('beforeafter');
    });

    test('empty with block with inline assignments', async () => {
      const result = await renderTemplate(
        'before{% with x = 1 %}{% endwith %}after'
      );
      expect(result).toBe('beforeafter');
    });

    test('with inside if block', async () => {
      const result = await renderTemplate(
        '{% if true %}{% with x = 42 %}{{ x }}{% endwith %}{% endif %}'
      );
      expect(result).toBe('42');
    });

    test('if inside with block', async () => {
      const result = await renderTemplate(
        '{% with x = 42 %}{% if x > 10 %}big{% else %}small{% endif %}{% endwith %}'
      );
      expect(result).toBe('big');
    });

    test('for inside with block', async () => {
      const result = await renderTemplate(
        '{% with items = [1, 2, 3] %}{% for i in items %}{{ i }}{% endfor %}{% endwith %}'
      );
      expect(result).toBe('123');
    });

    test('switch inside with block', async () => {
      const result = await renderTemplate(
        '{% with x = 2 %}{% switch x %}{% case 1 %}one{% case 2 %}two{% endswitch %}{% endwith %}'
      );
      expect(result).toBe('two');
    });
  });
});
