import { describe, test, expect } from 'bun:test';
import { isSafeString } from '@nunjucks/runtime';
import { isErr, getOrElse } from '@nunjucks/lib';
import {
  capitalize, fallback,
// biome-ignore lint/suspicious/noShadowRestrictedNames: `escape` is the public name of this Nunjucks filter; renaming would break every template that uses it.
  escape, tojson, indent,
  join as joinFilter, lower, replace, title, trim,
  truncate, upper, urlencode,
} from './string.ts';

describe('filters/string', () => {
  describe('capitalize', () => {
    test('uppercases the first character and lowercases the rest', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('hELLO')).toBe('Hello');
      expect(capitalize('Hello')).toBe('Hello');
    });

    test('returns empty string for empty input', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('fallback', () => {
    test('returns the value when it is not null/undefined and bool is false', () => {
      expect(fallback('value', 'default', false)).toBe('value');
      expect(fallback(0, 'default', false)).toBe(0);
      expect(fallback('', 'default', false)).toBe('');
    });

    test('returns the default for null and undefined', () => {
      expect(fallback(null, 'default')).toBe('default');
      expect(fallback(undefined, 'default')).toBe('default');
    });

    test('uses truthy check when bool is true', () => {
      expect(fallback('value', 'default', true)).toBe('value');
      expect(fallback(0, 'default', true)).toBe('default');
      expect(fallback('', 'default', true)).toBe('default');
    });
  });

  describe('escape', () => {
    test('escapes HTML special characters', () => {
      const result = escape('<div class="x">');
      expect(String(result)).toBe('&lt;div class=&quot;x&quot;&gt;');
      expect(isSafeString(result)).toBe(true);
    });

    test('escapes ampersands', () => {
      expect(String(escape('foo & bar'))).toBe('foo &amp; bar');
    });
  });

  describe('tojson', () => {
    test('serializes objects to JSON', () => {
      const result = tojson({ a: 1, b: 'two' });
      expect(String(result)).toBe('{"a":1,"b":"two"}');
      expect(isSafeString(result)).toBe(true);
    });

    test('serializes arrays to JSON', () => {
      expect(String(tojson([1, 2, 3]))).toBe('[1,2,3]');
    });

    test('serializes primitive values to JSON', () => {
      expect(String(tojson(42))).toBe('42');
      expect(String(tojson('hello'))).toBe('"hello"');
      expect(String(tojson(null))).toBe('null');
      expect(String(tojson(true))).toBe('true');
    });
  });

  describe('indent', () => {
    test('prepends spaces to every line except the first by default', () => {
      expect(indent('foo\nbar\nbaz')).toBe('foo\n    bar\n    baz');
    });

    test('indents every line including the first when indentfirst is true', () => {
      expect(indent('foo\nbar', 2, true)).toBe('  foo\n  bar');
    });

    test('uses the configured width', () => {
      expect(indent('foo\nbar', 2)).toBe('foo\n  bar');
      expect(indent('foo\nbar', 0)).toBe('foo\nbar');
    });

    test('returns empty string for empty input', () => {
      expect(indent('')).toBe('');
      expect(indent(null)).toBe('');
      expect(indent(undefined)).toBe('');
    });
  });

  describe('join', () => {
    test('joins array elements with a separator', () => {
      expect(getOrElse(joinFilter(['a', 'b', 'c']), null)).toBe('abc');
      expect(getOrElse(joinFilter(['a', 'b', 'c'], '-'), null)).toBe('a-b-c');
      expect(getOrElse(joinFilter(['a', 'b', 'c'], ', '), null)).toBe('a, b, c');
    });

    test('joins empty arrays to empty string', () => {
      expect(getOrElse(joinFilter([]), null)).toBe('');
    });

    test('joins object attribute values when attr is given', () => {
      const items = [{ name: 'alice' }, { name: 'bob' }];
      expect(getOrElse(joinFilter(items, ' & ', 'name'), null)).toBe('alice & bob');
    });

    test('returns error when input is not an array', () => {
      const result1 = joinFilter('not array');
      expect(isErr(result1)).toBe(true);
      const result2 = joinFilter({ 0: 'a' });
      expect(isErr(result2)).toBe(true);
    });
  });

  describe('lower', () => {
    test('lowercases the input', () => {
      expect(lower('HELLO')).toBe('hello');
      expect(lower('Hello')).toBe('hello');
      expect(lower('hello')).toBe('hello');
    });
  });

  describe('replace', () => {
    test('replaces every occurrence of a substring', () => {
      expect(replace('foo bar foo', 'foo', 'baz')).toBe('baz bar baz');
    });

    test('respects a maximum replacement count', () => {
      expect(replace('foo foo foo', 'foo', 'x', 2)).toBe('x x foo');
      expect(replace('foo foo foo', 'foo', 'x', 0)).toBe('foo foo foo');
    });

    test('supports RegExp patterns', () => {
      expect(replace('Hello World', /o/giu, '0')).toBe('Hell0 W0rld');
    });

    test('coerces numeric needle to string', () => {
      expect(replace('a1b2c3', 2, 'X')).toBe('a1bXc3');
    });

    test('returns the original string when the needle is not found', () => {
      expect(replace('hello', 'x', 'y')).toBe('hello');
    });

    test('returns the original string when it cannot be resolved as a string', () => {
      const obj = { toString: () => '' };
      expect(replace(obj, 'x', 'y')).toBe(obj as unknown as string);
    });
  });

  describe('title', () => {
    test('capitalizes every word', () => {
      expect(title('hello world')).toBe('Hello World');
    });

    test('lowercases the rest of each word', () => {
      expect(title('HELLO WORLD')).toBe('Hello World');
      expect(title('hELLo WoRLD')).toBe('Hello World');
    });
  });

  describe('trim', () => {
    test('removes leading and trailing whitespace', () => {
      expect(trim('  hello  ')).toBe('hello');
      expect(trim('\n\thello\t\n')).toBe('hello');
    });

    test('returns empty string for empty input', () => {
      expect(trim('')).toBe('');
      expect(trim('   ')).toBe('');
    });
  });

  describe('truncate', () => {
    test('returns the input unchanged when shorter than the length', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    test('truncates at the requested length with default end marker', () => {
      expect(truncate('hello world', 5)).toBe('hello...');
    });

    test('breaks at the last space before the limit when killwords is false', () => {
      expect(truncate('hello world foo', 10, false)).toBe('hello...');
    });

    test('breaks at the exact length when killwords is true', () => {
      expect(truncate('hello world foo', 10, true)).toBe('hello worl...');
    });

    test('uses a custom end marker', () => {
      expect(truncate('hello world', 5, true, '!')).toBe('hello!');
    });
  });

  describe('upper', () => {
    test('uppercases the input', () => {
      expect(upper('hello')).toBe('HELLO');
      expect(upper('Hello')).toBe('HELLO');
      expect(upper('HELLO')).toBe('HELLO');
    });
  });

  describe('urlencode', () => {
    test('encodes a plain string', () => {
      expect(urlencode('hello world')).toBe('hello%20world');
    });

    test('encodes object key/value pairs', () => {
      const params = { name: 'alice', age: '30' };
      expect(urlencode(params)).toBe('name=alice&age=30');
    });

    test('encodes an iterable of pairs', () => {
      const pairs = [['k', 'v'], ['x', 'y']];
      expect(urlencode(pairs)).toBe('k=v&x=y');
    });

    test('encodes special characters', () => {
      expect(urlencode('a=b&c=d')).toBe('a%3Db%26c%3Dd');
    });
  });
});