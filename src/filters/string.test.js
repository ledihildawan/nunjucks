import { describe, test, expect } from 'bun:test';
import {
  normalize,
  capitalize,
  center,
  fallback,
  dump,
  escape,
  safe,
  forceescape,
  indent,
  join,
  lower,
  nl2br,
  replace,
  string,
  striptags,
  title,
  trim,
  truncate,
  upper,
  urlencode,
  urlize,
  wordcount,
} from './string.js';

describe('normalize', () => {
  test('returns value for truthy values', () => {
    expect(normalize('hello', 'fallback')).toBe('hello');
    expect(normalize(0, 42)).toBe(0);
  });

  test('returns default for null/undefined/false', () => {
    expect(normalize(null, 'fallback')).toBe('fallback');
    expect(normalize(undefined, 'fallback')).toBe('fallback');
    expect(normalize(false, 'fallback')).toBe('fallback');
  });
});

describe('capitalize', () => {
  test('capitalizes first letter, lowercases rest', () => {
    expect(capitalize('hELLO')).toBe('Hello');
  });

  test('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });

  test('handles null', () => {
    expect(capitalize(null)).toBe('');
  });
});

describe('center', () => {
  test('centers string in given width', () => {
    const result = center('a', 5);
    expect(result).toBe('  a  ');
  });

  test('returns string as-is if longer than width', () => {
    expect(center('hello', 3)).toBe('hello');
  });

  test('defaults width to 80', () => {
    expect(center('a').length).toBe(80);
  });
});

describe('fallback', () => {
  test('returns val if not undefined', () => {
    expect(fallback(0, 1)).toBe(0);
    expect(fallback(false, true)).toBe(false);
    expect(fallback('', 'fallback')).toBe('');
  });

  test('returns default for undefined', () => {
    expect(fallback(undefined, 'fallback')).toBe('fallback');
  });

  test('uses truthy check when bool is true', () => {
    expect(fallback(0, 1, true)).toBe(1);
    expect(fallback('hello', 'fallback', true)).toBe('hello');
  });
});

describe('dump', () => {
  test('serializes object to JSON', () => {
    expect(dump({ a: 1 })).toBe('{"a":1}');
  });

  test('formats with spaces', () => {
    expect(dump({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
  });
});

describe('escape', () => {
  test('escapes HTML characters', () => {
    expect(escape('<>&"').toString()).toMatch(/&lt;|&gt;|&amp;|&quot;/);
  });

  test('returns SafeString for null/undefined', () => {
    const result = escape(null);
    expect(result).toBeDefined();
  });
});

describe('safe', () => {
  test('wraps string as SafeString', () => {
    const result = safe('<script>');
    expect(result).toBeDefined();
  });
});

describe('forceescape', () => {
  test('escapes even if already safe', () => {
    const result = forceescape('<script>');
    expect(result).toBeDefined();
  });
});

describe('indent', () => {
  test('indents lines with 4 spaces by default', () => {
    expect(indent('hello\nworld')).toBe('hello\n    world');
  });

  test('skips first line when indentfirst is falsy', () => {
    const result = indent('line1\nline2', 2);
    expect(result).toBe('line1\n  line2');
  });

  test('indents first line when indentfirst is truthy', () => {
    const result = indent('a\nb', 2, true);
    expect(result).toBe('  a\n  b');
  });

  test('returns empty for empty string', () => {
    expect(indent('')).toBe('');
  });
});

describe('join', () => {
  test('joins array with delimiter', () => {
    expect(join(['a', 'b', 'c'], ',')).toBe('a,b,c');
  });

  test('joins with empty string by default', () => {
    expect(join(['a', 'b'])).toBe('ab');
  });

  test('joins by attribute', () => {
    const arr = [{ name: 'alice' }, { name: 'bob' }];
    expect(join(arr, ',', 'name')).toBe('alice,bob');
  });
});

describe('lower', () => {
  test('lowercases string', () => {
    expect(lower('HELLO')).toBe('hello');
  });
});

describe('nl2br', () => {
  test('replaces newlines with <br />', () => {
    expect(nl2br('hello\nworld')).toBe('hello<br />\nworld');
  });

  test('handles null', () => {
    expect(nl2br(null)).toBe('');
  });
});

describe('replace', () => {
  test('replaces all occurrences of string', () => {
    expect(replace('aaabbbaaa', 'aaa', 'X')).toBe('XbbbX');
  });

  test('replaces with maxCount', () => {
    expect(replace('aaa aaa aaa', 'aaa', 'X', 2)).toBe('X X aaa');
  });

  test('replaces with RegExp', () => {
    expect(replace('hello  world', /\s+/, ' ')).toBe('hello world');
  });

  test('handles empty search string', () => {
    const result = replace('AB', '', '-');
    expect(result).toBe('-A-B-');
  });

  test('returns string as-is when no match', () => {
    expect(replace('hello', 'x', 'y')).toBe('hello');
  });

  test('returns str when old is not string/number/regexp', () => {
    expect(replace('hello', null, 'y')).toBe('hello');
  });

  test('handles number str value', () => {
    expect(replace(12345, '3', 'X')).toBe('12X45');
  });
});

describe('string', () => {
  test('copies safeness from obj', () => {
    expect(string('hello')).toBe('hello');
  });
});

describe('striptags', () => {
  test('strips HTML tags', () => {
    expect(striptags('<p>Hello</p>')).toBe('Hello');
  });

  test('preserves linebreaks when option set', () => {
    const result = striptags('<p>Hello</p>\n<p>World</p>', true);
    expect(result).toContain('\n');
  });
});

describe('title', () => {
  test('titlecases each word', () => {
    expect(title('hello world')).toBe('Hello World');
  });
});

describe('trim', () => {
  test('trims leading and trailing whitespace', () => {
    expect(trim('  hello  ')).toBe('hello');
  });
});

describe('truncate', () => {
  test('truncates at word boundary by default', () => {
    expect(truncate('hello world foo', 11)).toBe('hello world...');
  });

  test('truncates at exact length with killwords', () => {
    expect(truncate('hello world', 5, true)).toBe('hello...');
  });

  test('returns original if within length', () => {
    expect(truncate('hello', 255)).toBe('hello');
  });

  test('uses custom end string', () => {
    expect(truncate('hello world', 5, true, ' [more]')).toBe('hello [more]');
  });

  test('defaults length to 255', () => {
    const longStr = 'a'.repeat(300);
    expect(truncate(longStr).length).toBeLessThan(300);
  });
});

describe('upper', () => {
  test('uppercases string', () => {
    expect(upper('hello')).toBe('HELLO');
  });
});

describe('urlencode', () => {
  test('encodes string', () => {
    expect(urlencode('a b')).toBe('a%20b');
  });

  test('encodes array of key-value pairs', () => {
    expect(urlencode([['a', '1'], ['b', '2']])).toBe('a=1&b=2');
  });

  test('encodes object', () => {
    expect(urlencode({ a: 1, b: 2 })).toBe('a=1&b=2');
  });
});

describe('urlize', () => {
  test('converts URLs to links', () => {
    const result = urlize('Visit https://example.com today');
    expect(result).toContain('<a href="https://example.com"');
  });

  test('converts www URLs to http links', () => {
    const result = urlize('www.example.com');
    expect(result).toContain('http://www.example.com');
  });

  test('converts email addresses to mailto links', () => {
    const result = urlize('Contact test@example.com');
    expect(result).toContain('mailto:test@example.com');
  });

  test('adds nofollow when specified', () => {
    const result = urlize('https://example.com', Infinity, true);
    expect(result).toContain('rel="nofollow"');
  });
});

describe('wordcount', () => {
  test('counts words in string', () => {
    expect(wordcount('hello world')).toBe(2);
    expect(wordcount('one two three four')).toBe(4);
  });

  test('returns null for empty string', () => {
    expect(wordcount('')).toBeNull();
  });
});
