import { describe, expect, test } from 'bun:test';
import { getOrElse, isErr, isOk, isSafeString } from '@nunjucks/lib';
import { createKeywordArgs } from '@nunjucks/runtime';
import {
  capitalize,
  // biome-ignore lint/suspicious/noShadowRestrictedNames: `escape` is the public name of this Nunjucks filter; renaming it would break every template that uses it.
  escape,
  fallback,
  indent,
  join as joinFilter,
  lower,
  replace,
  title,
  tojson,
  trim,
  truncate,
  upper,
} from './string.ts';

describe('filters/string', () => {
  describe('capitalize', () => {
    test('uppercases the first character and lowercases the rest', () => {
      expect(getOrElse(capitalize('hello'), null)).toBe('Hello');
      expect(getOrElse(capitalize('hELLO'), null)).toBe('Hello');
      expect(getOrElse(capitalize('Hello'), null)).toBe('Hello');
    });

    test('returns empty string for empty input', () => {
      expect(getOrElse(capitalize(''), null)).toBe('');
    });
  });

  describe('fallback', () => {
    test('returns the value when it is not null/undefined and bool is false', () => {
      expect(getOrElse(fallback('value', 'default', false), null)).toBe('value');
      expect(getOrElse(fallback(0, 'default', false), null)).toBe(0);
      expect(getOrElse(fallback('', 'default', false), null)).toBe('');
    });

    test('returns the default for null and undefined', () => {
      expect(getOrElse(fallback(null, 'default'), null)).toBe('default');
      expect(getOrElse(fallback(undefined, 'default'), null)).toBe('default');
    });

    test('uses truthy check when bool is true', () => {
      expect(getOrElse(fallback('value', 'default', true), null)).toBe('value');
      expect(getOrElse(fallback(0, 'default', true), null)).toBe('default');
      expect(getOrElse(fallback('', 'default', true), null)).toBe('default');
    });
  });

  describe('escape', () => {
    test('escapes HTML special characters', () => {
      const result = getOrElse(escape('<div class="x">'), null);
      expect(String(result)).toBe('&lt;div class=&quot;x&quot;&gt;');
      expect(isSafeString(result)).toBe(true);
    });

    test('escapes ampersands', () => {
      expect(String(getOrElse(escape('foo & bar'), null))).toBe('foo &amp; bar');
    });
  });

  describe('tojson', () => {
    test('serializes objects to JSON', () => {
      const result = getOrElse(tojson({ a: 1, b: 'two' }), null);
      expect(String(result)).toBe('{"a":1,"b":"two"}');
      expect(isSafeString(result)).toBe(true);
    });

    test('serializes arrays to JSON', () => {
      expect(String(getOrElse(tojson([1, 2, 3]), null))).toBe('[1,2,3]');
    });

    test('serializes primitive values to JSON', () => {
      expect(String(getOrElse(tojson(42), null))).toBe('42');
      expect(String(getOrElse(tojson('hello'), null))).toBe('"hello"');
      expect(String(getOrElse(tojson(null), null))).toBe('null');
      expect(String(getOrElse(tojson(true), null))).toBe('true');
    });

    test('escapes markup-significant characters to prevent script-context breakout', () => {
      const result = String(getOrElse(tojson('</script><script>alert(1)</script>'), null));
      expect(result).toBe(
        '"\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e"'
      );
      expect(result).not.toContain('</script>');
    });

    test('escapes ampersands so SafeString output cannot reopen entities', () => {
      expect(String(getOrElse(tojson('a & b'), null))).toBe('"a \\u0026 b"');
    });

    test('round-trips through JSON.parse after markup escaping', () => {
      const payload = { bio: '</script><script>alert(1)</script>', link: 'a&b' };
      const serialized = String(getOrElse(tojson(payload), null));
      expect(JSON.parse(serialized)).toEqual(payload);
    });
  });

  describe('indent', () => {
    test('prepends spaces to every line except the first by default', () => {
      expect(getOrElse(indent('foo\nbar\nbaz'), null)).toBe('foo\n    bar\n    baz');
    });

    test('indents every line including the first when indentfirst is true', () => {
      expect(getOrElse(indent('foo\nbar', 2, true), null)).toBe('  foo\n  bar');
    });

    test('uses the configured width', () => {
      expect(getOrElse(indent('foo\nbar', 2), null)).toBe('foo\n  bar');
      expect(getOrElse(indent('foo\nbar', 0), null)).toBe('foo\nbar');
    });

    test('returns empty string for empty input', () => {
      expect(getOrElse(indent(''), null)).toBe('');
      expect(getOrElse(indent(null), null)).toBe('');
      expect(getOrElse(indent(undefined), null)).toBe('');
    });

    test('binds width and indentfirst from keyword arguments', () => {
      const result = indent('foo\nbar', { keywords: true, width: 2, indentfirst: true });
      expect(getOrElse(result, null)).toBe('  foo\n  bar');
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
      const stringInputResult = joinFilter('not array');
      expect(isErr(stringInputResult)).toBe(true);
      const objectInputResult = joinFilter({ 0: 'a' });
      expect(isErr(objectInputResult)).toBe(true);
    });

    test('returns error when an item lacks the requested attribute', () => {
      const result = joinFilter([{ name: 'alice' }, null], '-', 'name');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('lower', () => {
    test('lowercases the input', () => {
      expect(getOrElse(lower('HELLO'), null)).toBe('hello');
      expect(getOrElse(lower('Hello'), null)).toBe('hello');
      expect(getOrElse(lower('hello'), null)).toBe('hello');
    });
  });

  describe('replace', () => {
    test('replaces every occurrence of a substring', () => {
      expect(getOrElse(replace('foo bar foo', 'foo', 'baz'), null)).toBe('baz bar baz');
    });

    test('respects a maximum replacement count', () => {
      expect(getOrElse(replace('foo foo foo', 'foo', 'x', 2), null)).toBe('x x foo');
    });

    test('an omitted replacement deletes the needle (no comma coercion)', () => {
      // WHY: regression — undefined used to reach Array.join(undefined), coercing the
      // separator to ',' so replace("-") turned "a-b-c" into "a,b,c".
      expect(getOrElse(replace('a-b-c', '-'), null)).toBe('abc');
      expect(getOrElse(replace('aaa', 'a'), null)).toBe('');
      expect(getOrElse(replace('ab', ''), null)).toBe('ab');
    });

    test('an unknown kwarg for the replacement is rejected, not silently ignored', () => {
      // `new` is the upstream-style name; the registered kwarg is `newValue`. The
      // wrapper throws a catalogued UNKNOWN_FILTER_KWARG (runtime-contract throw,
      // funneled by handleError at the emit boundary).
      expect(() => replace('a-b', createKeywordArgs({ new: 'x' }))).toThrow(
        /Unknown keyword argument 'new'/
      );
    });

    test('supports RegExp patterns', () => {
      expect(getOrElse(replace('Hello World', /o/giu, '0'), null)).toBe('Hell0 W0rld');
    });

    test('coerces numeric needle to string', () => {
      expect(getOrElse(replace('a1b2c3', 2, 'X'), null)).toBe('a1bXc3');
    });

    test('returns the original string when the needle is not found', () => {
      expect(getOrElse(replace('hello', 'x', 'y'), null)).toBe('hello');
    });

    test('returns the original string when it cannot be resolved as a string', () => {
      const obj = { toString: () => '' };
      expect(getOrElse(replace(obj, 'x', 'y'), null)).toBe(obj as unknown as string);
    });

    test('binds old, newValue, and maxCount from keyword arguments', () => {
      const result = replace('foo foo foo', {
        keywords: true,
        old: 'foo',
        newValue: 'x',
        maxCount: 2,
      });
      expect(getOrElse(result, null)).toBe('x x foo');
    });
  });

  describe('title', () => {
    test('capitalizes every word', () => {
      expect(getOrElse(title('hello world'), null)).toBe('Hello World');
    });

    test('lowercases the rest of each word', () => {
      expect(getOrElse(title('HELLO WORLD'), null)).toBe('Hello World');
      expect(getOrElse(title('hELLo WoRLD'), null)).toBe('Hello World');
    });
  });

  describe('trim', () => {
    test('removes leading and trailing whitespace', () => {
      expect(getOrElse(trim('  hello  '), null)).toBe('hello');
      expect(getOrElse(trim('\n\thello\t\n'), null)).toBe('hello');
    });

    test('returns empty string for empty input', () => {
      expect(getOrElse(trim(''), null)).toBe('');
      expect(getOrElse(trim('   '), null)).toBe('');
    });
  });

  describe('truncate', () => {
    test('returns the input unchanged when shorter than the length', () => {
      expect(getOrElse(truncate('hello', 10), null)).toBe('hello');
    });

    test('truncates at the requested length with default end marker', () => {
      expect(getOrElse(truncate('hello world', 5), null)).toBe('hello...');
    });

    test('breaks at the last space before the limit when killwords is false', () => {
      expect(getOrElse(truncate('hello world foo', 10, false), null)).toBe('hello...');
    });

    test('breaks at the exact length when killwords is true', () => {
      expect(getOrElse(truncate('hello world foo', 10, true), null)).toBe('hello worl...');
    });

    test('uses a custom end marker', () => {
      expect(getOrElse(truncate('hello world', 5, true, '!'), null)).toBe('hello!');
    });

    test('binds length, killwords, and end from keyword arguments', () => {
      const result = truncate('hello world', { keywords: true, length: 5, end: '>>' });
      expect(getOrElse(result, null)).toBe('hello>>');
    });
  });

  describe('upper', () => {
    test('uppercases the input', () => {
      expect(getOrElse(upper('hello'), null)).toBe('HELLO');
      expect(getOrElse(upper('Hello'), null)).toBe('HELLO');
      expect(getOrElse(upper('HELLO'), null)).toBe('HELLO');
    });
  });

  describe('result wrapping', () => {
    test('every unified filter returns an ok result', () => {
      expect(isOk(capitalize('hello'))).toBe(true);
      expect(isOk(lower('HELLO'))).toBe(true);
      expect(isOk(upper('hello'))).toBe(true);
      expect(isOk(title('hello world'))).toBe(true);
      expect(isOk(trim('  x  '))).toBe(true);
      expect(isOk(truncate('hello', 2))).toBe(true);
      expect(isOk(tojson({ a: 1 }))).toBe(true);
      expect(isOk(fallback(null, 'def'))).toBe(true);
      expect(isOk(escape('<b>'))).toBe(true);
      expect(isOk(indent('a\nb'))).toBe(true);
      expect(isOk(replace('foo', 'f', 'b'))).toBe(true);
    });
  });
});
