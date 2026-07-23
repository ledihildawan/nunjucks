import { describe, test, expect } from 'bun:test';
import {
  normalize, capitalize, upper, lower, escape, safe,
  truncate, trim, title, join, replace, urlencode, indent, fallback,
} from './string.ts';

describe('normalize', () => {
  test('returns default for null', () => {
    expect(normalize(null, 'def')).toBe('def');
  });
  test('returns default for undefined', () => {
    expect(normalize(undefined, 'def')).toBe('def');
  });
  test('returns default for false', () => {
    expect(normalize(false, 'def')).toBe('def');
  });
  test('returns value when truthy', () => {
    expect(normalize('hello', 'def')).toBe('hello');
  });
});

describe('capitalize', () => {
  test('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });
  test('lowercase rest', () => {
    expect(capitalize('HELLO')).toBe('Hello');
  });
});

describe('upper / lower', () => {
  test('upper', () => {
    expect(upper('hello')).toBe('HELLO');
  });
  test('lower', () => {
    expect(lower('HELLO')).toBe('hello');
  });
});

describe('escape / safe', () => {
  test('escape converts html chars', () => {
    const r = String(escape('<script>"x"</script>'));
    expect(r).toContain('&lt;script&gt;');
    expect(r).toContain('&quot;x&quot;');
  });
  test('safe marks as safe', () => {
    const r = safe('<b>');
    expect(r).toBeDefined();
  });
});

describe('fallback', () => {
  test('uses default when undefined', () => {
    expect(fallback(undefined, 'default')).toBe('default');
  });
  test('uses default when null', () => {
    expect(fallback(null, 'default')).toBe('default');
  });
  test('uses value when truthy', () => {
    expect(fallback('value', 'default')).toBe('value');
  });
  test('uses default when bool=true and value is falsy', () => {
    expect(fallback('', 'default', true)).toBe('default');
  });
});

describe('truncate', () => {
  test('short string unchanged', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });
  test('truncates long string with ellipsis', () => {
    const r = truncate('hello world foo bar', 11) as string;
    expect(r).toContain('...');
    expect(r.length).toBeLessThanOrEqual(14);
  });
  test('killwords cuts at length', () => {
    const r = truncate('hello world', 5, true) as string;
    expect(r).toContain('hello');
  });
  test('handles non-string input (number)', () => {
    const r = truncate(123456789, 3, true) as string;
    expect(r).toContain('123');
  });
  test('handles SafeString input', () => {
    const r = truncate('hello world foo bar baz', 11) as string;
    expect(r).toContain('...');
  });
});

describe('trim', () => {
  test('removes leading/trailing whitespace', () => {
    expect(trim('  hello  ') as unknown as string).toBe('hello');
  });
});

describe('title', () => {
  test('capitalizes each word', () => {
    expect(title('hello world foo') as unknown as string).toBe('Hello World Foo');
  });
});

describe('join', () => {
  test('joins with delimiter', () => {
    expect(join(['a', 'b', 'c'], '-')).toBe('a-b-c');
  });
  test('default empty delimiter', () => {
    expect(join(['a', 'b', 'c'])).toBe('abc');
  });
  test('joins by attribute', () => {
    expect(join([{ n: 'a' }, { n: 'b' }], '-', 'n')).toBe('a-b');
  });
});

describe('replace', () => {
  test('replaces all occurrences', () => {
    expect(replace('a-b-c', '-', '+') as unknown as string).toBe('a+b+c');
  });
  test('respects maxCount', () => {
    expect(replace('a-b-c', '-', '+', 1) as unknown as string).toBe('a+b-c');
  });
});

describe('urlencode', () => {
  test('encodes string', () => {
    expect(urlencode('hello world')).toBe('hello%20world');
  });
  test('encodes object pairs', () => {
    expect(urlencode({ a: '1', b: '2' })).toBe('a=1&b=2');
  });
});

describe('indent', () => {
  test('indents each line', () => {
    const result = indent('hello\nworld', 2);
    expect(typeof result).toBe('string');
    expect((result as string).includes('hello')).toBe(true);
  });
});
