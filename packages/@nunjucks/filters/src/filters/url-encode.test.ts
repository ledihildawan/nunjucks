import { describe, expect, test } from 'bun:test';
import { getOrElse, isErr, isOk } from '@nunjucks/lib';
import { urlencode } from './url-encode.ts';

describe('filters/urlencode', () => {
  test('encodes a plain string', () => {
    expect(getOrElse(urlencode('hello world'), null)).toBe('hello%20world');
  });

  test('encodes object key/value pairs', () => {
    const params = { name: 'alice', age: '30' };
    expect(getOrElse(urlencode(params), null)).toBe('name=alice&age=30');
  });

  test('encodes an iterable of pairs', () => {
    const pairs = [
      ['k', 'v'],
      ['x', 'y'],
    ];
    expect(getOrElse(urlencode(pairs), null)).toBe('k=v&x=y');
  });

  test('encodes special characters', () => {
    expect(getOrElse(urlencode('a=b&c=d'), null)).toBe('a%3Db%26c%3Dd');
  });

  test('returns error for non-pair array items', () => {
    expect(isErr(urlencode([1, 2]))).toBe(true);
    expect(isErr(urlencode([['only-key']]))).toBe(true);
  });

  test('returns error for unsupported input types', () => {
    expect(isErr(urlencode(42))).toBe(true);
    expect(isErr(urlencode(true))).toBe(true);
    expect(isErr(urlencode(null))).toBe(true);
  });

  test('returns an ok result for conforming input', () => {
    expect(isOk(urlencode('a b'))).toBe(true);
  });
});
