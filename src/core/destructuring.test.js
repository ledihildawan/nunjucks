import { describe, test, expect } from 'bun:test';
import { render } from './render.js';
import { mergeConfig } from '../config/global.js';

const renderTemplate = async (template, context = {}, config = {}) => {
  return await render(template, context, mergeConfig({
    autoescape: false,
    ...config
  }));
};

describe('destructuring - array', () => {
  test('basic array destructuring', async () => {
    const html = await renderTemplate(
      '{% set [a, b, c] = [1, 2, 3] %}{{ a }}-{{ b }}-{{ c }}',
      {}
    );
    expect(html).toBe('1-2-3');
  });

  test('array destructuring with rest', async () => {
    const html = await renderTemplate(
      '{% set [first, ...rest] = [1, 2, 3, 4] %}{{ first }}-{{ rest |> join(",") }}',
      {}
    );
    expect(html).toBe('1-2,3,4');
  });

  test('array destructuring with holes', async () => {
    const html = await renderTemplate(
      '{% set [a, , c] = [1, 2, 3] %}{{ a }}-{{ c }}',
      {}
    );
    expect(html).toBe('1-3');
  });

  test('array destructuring with default', async () => {
    const html = await renderTemplate(
      '{% set [a, b = 99] = [1] %}{{ a }}-{{ b }}',
      {}
    );
    expect(html).toBe('1-99');
  });

  test('array destructuring with nested object', async () => {
    const html = await renderTemplate(
      '{% set [a, {name}] = [1, {name: "John"}] %}{{ a }}-{{ name }}',
      {}
    );
    expect(html).toBe('1-John');
  });
});

describe('destructuring - object', () => {
  test('basic object destructuring', async () => {
    const html = await renderTemplate(
      '{% set {a, b} = {a: 1, b: 2} %}{{ a }}-{{ b }}',
      {}
    );
    expect(html).toBe('1-2');
  });

  test('object destructuring with alias', async () => {
    const html = await renderTemplate(
      '{% set {a: x, b: y} = {a: 1, b: 2} %}{{ x }}-{{ y }}',
      {}
    );
    expect(html).toBe('1-2');
  });

  test('object destructuring with rest', async () => {
    const html = await renderTemplate(
      '{% set {a, ...rest} = {a: 1, b: 2, c: 3} %}{{ a }}-{{ rest.b }}-{{ rest.c }}',
      {}
    );
    expect(html).toBe('1-2-3');
  });

  test('object destructuring with default', async () => {
    const html = await renderTemplate(
      '{% set {a, b = 99} = {a: 1} %}{{ a }}-{{ b }}',
      {}
    );
    expect(html).toBe('1-99');
  });

  test('object destructuring with nested array', async () => {
    const html = await renderTemplate(
      '{% set {items: [first, second]} = {items: [10, 20]} %}{{ first }}-{{ second }}',
      {}
    );
    expect(html).toBe('10-20');
  });

  test('object destructuring missing key', async () => {
    const html = await renderTemplate(
      '{% set {a, b} = {a: 1} %}{{ a }}-{{ b }}',
      {}
    );
    expect(html).toBe('1-undefined');
  });
});

describe('destructuring - for', () => {
  test('for with array destructuring', async () => {
    const html = await renderTemplate(
      '{% for [k, v] in pairs %}{{ k }}={{ v }};{% endfor %}',
      { pairs: [['a', 1], ['b', 2]] }
    );
    expect(html).toBe('a=1;b=2;');
  });

  test('for with object destructuring', async () => {
    const html = await renderTemplate(
      '{% for {name, age} in users %}{{ name }}({{ age }});{% endfor %}',
      { users: [{name: 'A', age: 1}, {name: 'B', age: 2}] }
    );
    expect(html).toBe('A(1);B(2);');
  });
});
