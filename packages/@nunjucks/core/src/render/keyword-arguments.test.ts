import { describe, test, expect } from 'bun:test';
import { render } from './render.ts';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => await render(template, context, {
  autoescape: false,
  ...config
} as Record<string, unknown>);

describe('keyword arguments rendering', () => {
  describe('global functions with kwargs', () => {
    test('global function with kwargs', async () => {
      const greet = ({name = 'World', greeting = 'Hello'} = {}) => `${greeting} ${name}!`;
      const result = await renderTemplate('{{ greet(name="John", greeting="Hi") }}', {}, { globals: { greet } });
      expect(result.trim()).toBe('Hi John!');
    });

    test('global function with partial kwargs using defaults', async () => {
      const greet = ({name = 'World', greeting = 'Hello'} = {}) => `${greeting} ${name}!`;
      const result = await renderTemplate('{{ greet() }}', {}, { globals: { greet } });
      expect(result.trim()).toBe('Hello World!');
    });

    test('global function with nested destructuring', async () => {
      const formatUser = ({user: {firstName = 'Anonymous', lastName = ''} = {} } = {}) => `${firstName} ${lastName}`;
      const result = await renderTemplate(
        '{{ formatUser(user=(user)) }}',
        { user: { firstName: 'John', lastName: 'Doe' } },
        { globals: { formatUser } }
      );
      expect(result.trim()).toBe('John Doe');
    });

    test('global function with number kwargs', async () => {
      const addNumbers = ({a = 0, b = 0} = {}) => a + b;
      const result = await renderTemplate('{{ addNumbers(a=5, b=3) }}', {}, { globals: { addNumbers } });
      expect(result.trim()).toBe('8');
    });
  });

  describe('method calls with kwargs', () => {
    test('method call with kwargs', async () => {
      const obj = {
        name: 'myObject',
        greet({suffix = '!'} = {}) {
          return this.name + suffix;
        }
      };
      const result = await renderTemplate('{{ obj.greet(suffix="???") }}', {}, { globals: { obj } });
      expect(result.trim()).toBe('myObject???');
    });

    test('method call without kwargs uses default', async () => {
      const obj = {
        name: 'myObject',
        greet({suffix = '!'} = {}) {
          return this.name + suffix;
        }
      };
      const result = await renderTemplate('{{ obj.greet() }}', {}, { globals: { obj } });
      expect(result.trim()).toBe('myObject!');
    });

    test('method chain with kwargs', async () => {
      const calculator = {
        double: ({value = 0} = {}) => value * 2,
        triple: ({value = 0} = {}) => value * 3
      };
      const result = await renderTemplate(
        '{{ calculator.double(value=(calculator.triple(value=2))) }}',
        {},
        { globals: { calculator } }
      );
      expect(result.trim()).toBe('12');
    });
  });

  describe('filters with kwargs', () => {
    test('filter with kwargs', async () => {
      const myFilter = (val: unknown, {prefix = '', suffix = ''}: {prefix?: string; suffix?: string} = {}) => `${prefix}${String(val)}${suffix}`;
      const result = await renderTemplate(
        '{{ "test" |> myFilter(prefix="<<", suffix=">>") }}',
        {},
        { filters: { myFilter } }
      );
      expect(result.trim()).toBe('<<test>>');
    });

    test('filter with partial kwargs', async () => {
      const myFilter = (val: unknown, {prefix = '', suffix = ''}: {prefix?: string; suffix?: string} = {}) => `${prefix}${String(val)}${suffix}`;
      const result = await renderTemplate(
        '{{ "test" |> myFilter(prefix="__") }}',
        {},
        { filters: { myFilter } }
      );
      expect(result.trim()).toBe('__test');
    });

    test('filter without kwargs uses defaults', async () => {
      const myFilter = (val: unknown, {suffix = '!'}: {suffix?: string} = {}) => `${String(val)}${suffix}`;
      const result = await renderTemplate('{{ "hi" |> myFilter }}', {}, { filters: { myFilter } });
      expect(result.trim()).toBe('hi!');
    });

    test('chained filters with kwargs', async () => {
      const addPrefix = (val: unknown, {prefix = ''}: {prefix?: string} = {}) => `${prefix}${String(val)}`;
      const addSuffix = (val: unknown, {suffix = ''}: {suffix?: string} = {}) => `${String(val)}${suffix}`;
      const result = await renderTemplate(
        '{{ "text" |> addPrefix(prefix="[[") |> addSuffix(suffix="]]") }}',
        {},
        { filters: { addPrefix, addSuffix } }
      );
      expect(result.trim()).toBe('[[text]]');
    });
  });

  describe('components with kwargs', () => {
    test('component with kwargs', async () => {
      const template = `
{% component greet(name='World') %}
Hello {{ name }}
{% endcomponent %}
{{ greet(name='Alice') }}
`;
      const result = await renderTemplate(template, {}, {});
      expect(result.trim()).toBe('Hello Alice');
    });

    test('component with partial kwargs', async () => {
      const template = `
{% component format(name='Anonymous', greeting='Hello') %}
{{ greeting }} {{ name }}
{% endcomponent %}
{{ format(greeting="Hi") }}
`;
      const result = await renderTemplate(template, {}, {});
      expect(result.trim()).toBe('Hi Anonymous');
    });
  });

  describe('nested calls with kwargs', () => {
    test('nested calls - outer(inner(kwargs))', async () => {
      const inner = ({x = 'default'} = {}) => x;
      const outer = (val: unknown) => `[${String(val)}]`;
      const result = await renderTemplate(
        '{{ outer(inner(x="nested")) }}',
        {},
        { globals: { inner, outer } }
      );
      expect(result.trim()).toBe('[nested]');
    });

    test('nested calls - both with kwargs', async () => {
      const inner2 = ({x = 1, y = 2} = {}) => x + y;
      const outer2 = ({val = 0} = {}) => val * 10;
      const result = await renderTemplate(
        '{{ outer2(val=(inner2(x=3, y=4))) }}',
        {},
        { globals: { inner2, outer2 } }
      );
      expect(result.trim()).toBe('70');
    });
  });

  describe('mixed positional and keyword args', () => {
    test('mixed positional and keyword args', async () => {
      const mixed = (a: unknown, {b = 'default_b', c = 'default_c'}: {b?: string; c?: string} = {}) => `${String(a)}-${b}-${c}`;
      const result = await renderTemplate(
        '{{ mixed("first", b="second") }}',
        {},
        { globals: { mixed } }
      );
      expect(result.trim()).toBe('first-second-default_c');
    });
  });
});
