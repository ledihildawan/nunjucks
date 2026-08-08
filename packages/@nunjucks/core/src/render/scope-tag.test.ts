import { describe, test, expect } from 'bun:test';
import { render } from './render.ts';
import { isErr } from '@nunjucks/shared';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => {
  const result = await render(template, {
    context,
    autoescape: false,
    ...config
  });
  if (isErr(result)) { throw result.error; }
  return result.value;
};

describe('with tag', () => {
  describe('set inside scope (Form 1)', () => {
    test('creates isolated scope', async () => {
      const result = await renderTemplate(
        '{{ x := 1 }}{% scope %}{{ x := 2 }}{% endscope %}{{ x }}'
      );
      expect(result).toBe('1');
    });

    test('variable set inside scope does not leak', async () => {
      const result = await renderTemplate(
        '{% scope %}{{ inside := "yes" }}{% endscope %}{{ inside }}'
      );
      expect(result).not.toContain('yes');
    });

    test('can read parent variables inside scope', async () => {
      const result = await renderTemplate(
        '{{ x := "parent" }}{% scope %}{{ x }}{% endscope %}'
      );
      expect(result).toBe('parent');
    });

    test('nested scope blocks are isolated', async () => {
      const result = await renderTemplate(
        '{{ x := 0 }}{% scope %}{{ x := 1 }}{% scope %}{{ x := 2 }}{% endscope %}{{ x }}{% endscope %}{{ x }}'
      );
      expect(result).toBe('10');
    });

    test('with inside for loop', async () => {
      const result = await renderTemplate(
        '{% for i in [1, 2] %}{% scope %}{{ x := i * 10 }}{{ x }}{% endscope %}{% endfor %}'
      );
      expect(result).toBe('1020');
    });

    test('with preserves original variable', async () => {
      const result = await renderTemplate(
        '{{ msg := "original" }}{% scope %}{{ msg := "changed" }}{% endscope %}{{ msg }}'
      );
      expect(result).toBe('original');
    });

    test('multiple variables inside scope are isolated', async () => {
      const result = await renderTemplate(
        '{% scope %}{{ a := 1 }}{{ b := 2 }}{{ a + b }}{% endscope %}'
      );
      expect(result).toBe('3');
    });
  });

  describe('inline assignments (Form 2: Jinja2-style)', () => {
    test('single inline assignment', async () => {
      const result = await renderTemplate(
        '{% scope x = 42 %}{{ x }}{% endscope %}'
      );
      expect(result).toBe('42');
    });

    test('multiple inline assignments', async () => {
      const result = await renderTemplate(
        '{% scope x = 1, y = 2 %}{{ x + y }}{% endscope %}'
      );
      expect(result).toBe('3');
    });

    test('inline assignment with expression', async () => {
      const result = await renderTemplate(
        '{% scope total = items.length %}{{ total }}{% endscope %}',
        { items: [1, 2, 3] }
      );
      expect(result).toBe('3');
    });

    test('inline assignment with function call', async () => {
      const result = await renderTemplate(
        '{% scope greeting = greet("World") %}{{ greeting }}{% endscope %}',
        { greet: (name: string) => `Hello ${name}` }
      );
      expect(result).toBe('Hello World');
    });

    test('inline assignment does not leak to parent', async () => {
      const result = await renderTemplate(
        '{% scope x = 42 %}{% endscope %}{{ x }}'
      );
      expect(result).toBe('undefined');
    });

    test('inline assignment can read parent variables', async () => {
      const result = await renderTemplate(
        '{{ base := 10 }}{% scope x = base * 2 %}{{ x }}{% endscope %}'
      );
      expect(result).toBe('20');
    });

    test('nested inline assignments are isolated', async () => {
      const result = await renderTemplate(
        '{% scope x = 1 %}{% scope x = 2 %}{{ x }}{% endscope %}{{ x }}{% endscope %}'
      );
      expect(result).toBe('21');
    });

    test('inline and set inside can coexist', async () => {
      const result = await renderTemplate(
        '{% scope x = 1 %}{{ y := 2 }}{{ x + y }}{% endscope %}'
      );
      expect(result).toBe('3');
    });

    test('inline assignment with arithmetic expression', async () => {
      const result = await renderTemplate(
        '{% scope a = 3, b = 4, c = a * b %}{{ c }}{% endscope %}'
      );
      expect(result).toBe('12');
    });

    test('inline assignment with string concatenation', async () => {
      const result = await renderTemplate(
        '{% scope first = "Hello", second = "World" %}{{ first + " " + second }}{% endscope %}'
      );
      expect(result).toBe('Hello World');
    });
  });

  describe('edge cases', () => {
    test('empty scope block', async () => {
      const result = await renderTemplate(
        'before{% scope %}{% endscope %}after'
      );
      expect(result).toBe('beforeafter');
    });

    test('empty scope block with inline assignments', async () => {
      const result = await renderTemplate(
        'before{% scope x = 1 %}{% endscope %}after'
      );
      expect(result).toBe('beforeafter');
    });

    test('with inside if block', async () => {
      const result = await renderTemplate(
        '{% if true %}{% scope x = 42 %}{{ x }}{% endscope %}{% endif %}'
      );
      expect(result).toBe('42');
    });

    test('if inside scope block', async () => {
      const result = await renderTemplate(
        '{% scope x = 42 %}{% if x > 10 %}big{% else %}small{% endif %}{% endscope %}'
      );
      expect(result).toBe('big');
    });

    test('for inside scope block', async () => {
      const result = await renderTemplate(
        '{% scope items = [1, 2, 3] %}{% for i in items %}{{ i }}{% endfor %}{% endscope %}'
      );
      expect(result).toBe('123');
    });

    test('switch inside scope block', async () => {
      const result = await renderTemplate(
        '{% scope x = 2 %}{% switch x %}{% case 1 %}one{% case 2 %}two{% endswitch %}{% endscope %}'
      );
      expect(result).toBe('two');
    });
  });
});
