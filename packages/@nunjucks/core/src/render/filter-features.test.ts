import { describe, test, expect } from 'bun:test';
import { renderTemplate } from './render-test-helper.ts';

describe('string filters', () => {
  test('upper', async () => {
    const result = await renderTemplate('{{ "hello" |> upper }}', {});
    expect(result).toBe('HELLO');
  });

  test('lower', async () => {
    const result = await renderTemplate('{{ "HELLO" |> lower }}', {});
    expect(result).toBe('hello');
  });

  test('capitalize', async () => {
    const result = await renderTemplate('{{ "hello world" |> capitalize }}', {});
    expect(result).toBe('Hello world');
  });

  test('capitalize - lowercases the rest', async () => {
    const result = await renderTemplate('{{ "HELLO" |> capitalize }}', {});
    expect(result).toBe('Hello');
  });

  test('title', async () => {
    const result = await renderTemplate('{{ "hello world" |> title }}', {});
    expect(result).toBe('Hello World');
  });

  test('trim', async () => {
    const result = await renderTemplate('{{ "  hello  " |> trim }}', {});
    expect(result).toBe('hello');
  });

  test('replace with one arg', async () => {
    const result = await renderTemplate('{{ "hello world" |> replace("o", "0") }}', {});
    expect(result).toBe('hell0 w0rld');
  });

  test('truncate - default', async () => {
    const result = await renderTemplate('{{ "Hello World" |> truncate }}', {});
    expect(result).toBe('Hello World');
  });

  test('truncate - custom length', async () => {
    const result = await renderTemplate('{{ "Hello World" |> truncate(5) }}', {});
    expect(result).toBe('Hello...');
  });

  test('truncate - with end', async () => {
    const result = await renderTemplate('{{ "Hello World" |> truncate(5, false, ">>>") }}', {});
    expect(result).toBe('Hello>>>');
  });

  test('truncate - killwords', async () => {
    const result = await renderTemplate('{{ "hello world" |> truncate(5, true) }}', {});
    expect(result).toContain('hello');
  });

  test('indent - each line', async () => {
    const result = await renderTemplate('{{ "hello\nworld" |> indent(2) }}', {});
    expect(result).toContain('hello');
  });

  test('urlencode - string', async () => {
    const result = await renderTemplate('{{ "hello world" |> urlencode }}', {});
    expect(result).toBe('hello%20world');
  });
});

describe('array filters', () => {
  test('first - array', async () => {
    const result = await renderTemplate('{{ [1, 2, 3] |> first }}', {});
    expect(result).toBe('1');
  });

  test('last - array', async () => {
    const result = await renderTemplate('{{ [1, 2, 3] |> last }}', {});
    expect(result).toBe('3');
  });

  test('length - array', async () => {
    const result = await renderTemplate('{{ [1, 2, 3] |> length }}', {});
    expect(result).toBe('3');
  });

  test('length - string', async () => {
    const result = await renderTemplate('{{ "hello" |> length }}', {});
    expect(result).toBe('5');
  });

  test('reverse - array', async () => {
    const result = await renderTemplate('{{ [1, 2, 3] |> reverse |> join(",") }}', {});
    expect(result).toBe('3,2,1');
  });

  test('reverse - string', async () => {
    const result = await renderTemplate('{{ "hello" |> reverse }}', {});
    expect(result).toBe('olleh');
  });

  test('join - with separator', async () => {
    const result = await renderTemplate('{{ ["a", "b", "c"] |> join("-") }}', {});
    expect(result).toBe('a-b-c');
  });

  test('join - without separator', async () => {
    const result = await renderTemplate('{{ ["a", "b", "c"] |> join }}', {});
    expect(result).toBe('abc');
  });

  test('reverse - via join without separator', async () => {
    const result = await renderTemplate('{{ [1, 2, 3] |> reverse |> join }}', {});
    expect(result).toBe('321');
  });

  test('slice - even split', async () => {
    const result = await renderTemplate('{% for s in [1, 2, 3, 4, 5, 6] |> slice(2) %}{{ s |> join("") }}{% endfor %}', {});
    expect(result).toBe('123456');
  });

  test('sort - numbers ascending', async () => {
    const result = await renderTemplate('{{ [3, 1, 4, 2] |> sort |> join(",") }}', {});
    expect(result).toBe('1,2,3,4');
  });

  test('sort - with reverse', async () => {
    const result = await renderTemplate('{{ [3, 1, 4, 2] |> sort(true) |> join(",") }}', {});
    expect(result).toBe('4,3,2,1');
  });

  test('sum - array', async () => {
    const result = await renderTemplate('{{ [1, 2, 3] |> sum }}', {});
    expect(result).toBe('6');
  });
});

describe('math filters', () => {
  test('abs - positive number', async () => {
    const result = await renderTemplate('{{ 5 |> abs }}', {});
    expect(result).toBe('5');
  });

  test('abs - negative number', async () => {
    const result = await renderTemplate('{{ -5 |> abs }}', {});
    expect(result).toBe('5');
  });

  test('abs - zero', async () => {
    const result = await renderTemplate('{{ 0 |> abs }}', {});
    expect(result).toBe('0');
  });

  test('round - default', async () => {
    const result = await renderTemplate('{{ 4.5 |> round }}', {});
    expect(result).toBe('5');
  });

  test('round - precision 1', async () => {
    const result = await renderTemplate('{{ 4.555 |> round(1) }}', {});
    expect(result).toBe('4.6');
  });

  test('round - floor', async () => {
    const result = await renderTemplate('{{ 4.4 |> round }}', {});
    expect(result).toBe('4');
  });

  test('round - precision 2', async () => {
    const result = await renderTemplate('{{ 1.23456 |> round(2) }}', {});
    expect(result).toBe('1.23');
  });

  test('round - ceil method', async () => {
    const result = await renderTemplate('{{ 3.1 |> round(0, "ceil") }}', {});
    expect(result).toBe('4');
  });

  test('round - floor method', async () => {
    const result = await renderTemplate('{{ 3.9 |> round(0, "floor") }}', {});
    expect(result).toBe('3');
  });

  test('round - 3.7 rounds up', async () => {
    const result = await renderTemplate('{{ 3.7 |> round }}', {});
    expect(result).toBe('4');
  });

  test('round - 3.3 rounds down', async () => {
    const result = await renderTemplate('{{ 3.3 |> round }}', {});
    expect(result).toBe('3');
  });
});

describe('default filter', () => {
  test('default - undefined value', async () => {
    const result = await renderTemplate('{{ foo |> default("bar") }}', {});
    expect(result).toBe('bar');
  });

  test('default - null value', async () => {
    const result = await renderTemplate('{{ value |> default("def") }}', { value: null });
    expect(result).toBe('def');
  });

  test('default - defined value', async () => {
    const result = await renderTemplate('{{ foo |> default("bar") }}', { foo: 'hello' });
    expect(result).toBe('hello');
  });
});

describe('escape filters', () => {
  test('e filter - alias for escape', async () => {
    const result = await renderTemplate('{{ "<script>" |> e }}', {});
    expect(result).toBe('&lt;script&gt;');
  });

  test('escape filter', async () => {
    const result = await renderTemplate('{{ "<script>" |> escape }}', {});
    expect(result).toBe('&lt;script&gt;');
  });

  test('tojson filter', async () => {
    const result = await renderTemplate('{{ {"a":1} |> tojson }}', {});
    expect(result).toBe('{"a":1}');
  });
});

describe('groupby filter', () => {
  test('groupby - groups items by attribute', async () => {
    const items = [
      { type: 'fruit', name: 'apple' },
      { type: 'fruit', name: 'banana' },
      { type: 'veg', name: 'carrot' },
    ];
    const result = await renderTemplate('{{ items |> groupby("type") |> length }}', { items });
    expect(result).toBe('2');
  });
});

describe('built-in tests (is operator)', () => {
  test('is defined - true', async () => {
    const result = await renderTemplate('{% if value is defined %}yes{% else %}no{% endif %}', { value: 'hello' });
    expect(result).toBe('yes');
  });

  test('is defined - false', async () => {
    const result = await renderTemplate('{% if value is defined %}yes{% else %}no{% endif %}', {});
    expect(result).toBe('no');
  });

  test('is null - true', async () => {
    const result = await renderTemplate('{% if value is null %}yes{% else %}no{% endif %}', { value: null });
    expect(result).toBe('yes');
  });

  test('is null - false', async () => {
    const result = await renderTemplate('{% if value is null %}yes{% else %}no{% endif %}', { value: 'hello' });
    expect(result).toBe('no');
  });

  test('is sameas - true', async () => {
    const result = await renderTemplate('{% if value is sameas(true) %}yes{% else %}no{% endif %}', { value: true });
    expect(result).toBe('yes');
  });

  test('is sameas - false', async () => {
    const result = await renderTemplate('{% if value is sameas(true) %}yes{% else %}no{% endif %}', { value: 1 });
    expect(result).toBe('no');
  });

  test('is iterable - true', async () => {
    const result = await renderTemplate('{% if [1,2,3] is iterable %}yes{% else %}no{% endif %}', {});
    expect(result).toBe('yes');
  });

  test('is iterable - false', async () => {
    const result = await renderTemplate('{% if 42 is iterable %}yes{% else %}no{% endif %}', {});
    expect(result).toBe('no');
  });
});

describe('custom filter registration', () => {
  test('custom filter via config.filters', async () => {
    const result = await renderTemplate('{{ x |> repeat(3) }}', { x: 'ab' }, { filters: { repeat: (s: string, n: number) => s.repeat(n) } });
    expect(result).toBe('ababab');
  });
});

describe('custom test registration', () => {
  test('custom test via config.tests', async () => {
    const result = await renderTemplate('{% if x is positive %}yes{% else %}no{% endif %}', { x: 5 }, { tests: { positive: (v: unknown) => typeof v === 'number' && v > 0 } });
    expect(result).toBe('yes');
  });
});

describe('SafeString tests (is safe / is escaped)', () => {
  test('is safe with SafeString value', async () => {
    const { createSafeString } = await import('@nunjucks/runtime');
    const result = await renderTemplate('{{ x is safe }}', { x: createSafeString('hi') });
    expect(result).toBe('true');
  });
  test('is safe with plain string', async () => {
    const result = await renderTemplate('{{ x is safe }}', { x: 'hi' });
    expect(result).toBe('false');
  });
  test('is escaped with plain string', async () => {
    const result = await renderTemplate('{{ x is escaped }}', { x: 'hi' });
    expect(result).toBe('true');
  });
});

describe('builtin test keywords (capitalized instanceof tests)', () => {
  test('is Map', async () => {
    expect(await renderTemplate('{{ x is Map }}', { x: new Map() })).toBe('true');
    expect(await renderTemplate('{{ x is Map }}', { x: new Set() })).toBe('false');
  });
  test('is Set', async () => {
    expect(await renderTemplate('{{ x is Set }}', { x: new Set() })).toBe('true');
  });
  test('is Date', async () => {
    expect(await renderTemplate('{{ x is Date }}', { x: new Date() })).toBe('true');
  });
  test('is none (null or undefined)', async () => {
    expect(await renderTemplate('{{ x is none }}', { x: null })).toBe('true');
    expect(await renderTemplate('{{ x is none }}', { x: 0 })).toBe('false');
  });
});

describe('filter block', () => {
  test('applies filter to block content', async () => {
    const result = await renderTemplate('{% filter upper %}hello{% endfilter %}');
    expect(result).toBe('HELLO');
  });
  test('applies filter to expression content', async () => {
    const result = await renderTemplate('{% filter upper %}{{ name }}{% endfilter %}', { name: 'world' });
    expect(result).toBe('WORLD');
  });
  test('filter with arguments', async () => {
    const result = await renderTemplate('{% filter replace("o", "0") %}hello{% endfilter %}');
    expect(result).toBe('hell0');
  });
});

describe('sanitize filter', () => {
  test('strips <script> tags and their content', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: '<script>alert(1)</script>' });
    expect(result).toBe('');
  });

  test('strips onerror event handler but keeps the tag', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: '<img src="x" onerror="alert(1)">' });
    expect(result).toContain('<img');
    expect(result).not.toContain('onerror');
  });

  test('strips inline event handlers from safe tags', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: '<a href="x" onclick="alert(1)">link</a>' });
    expect(result).not.toContain('onclick');
    expect(result).toContain('link');
  });

  test('strips javascript: href', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: '<a href="javascript:alert(1)">x</a>' });
    expect(result).not.toContain('javascript:');
  });

  test('keeps <b>, <i>, <p>', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: '<b>bold</b><i>italic</i><p>para</p>' });
    expect(result).toContain('<b>bold</b>');
    expect(result).toContain('<p>para</p>');
  });

  test('keeps nested safe tags unchanged', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: '<p>Hello <b>world</b></p>' });
    expect(result).toBe('<p>Hello <b>world</b></p>');
  });

  test('leaves plain text untouched', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: 'just text' });
    expect(result).toBe('just text');
  });

  test('empty string yields empty string', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: '' });
    expect(result).toBe('');
  });

  test('null is coerced to the literal string "null"', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: null });
    expect(result).toBe('null');
  });

  test('undefined is coerced to the literal string "undefined"', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: undefined });
    expect(result).toBe('undefined');
  });

  test('number is coerced to its string form', async () => {
    const result = await renderTemplate('{{ x |> sanitize }}', { x: 42 });
    expect(result).toBe('42');
  });
});