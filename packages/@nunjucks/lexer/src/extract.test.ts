import { describe, test, expect } from 'bun:test';
import { extractWhile, extractUntil, parseStringContent } from './extract.ts';

describe('extractWhile', () => {
  test('consumes chars while they are in the allowed set', () => {
    expect(extractWhile('abc123!', 0, 'abc')).toBe('abc');
  });

  test('starts from the given index', () => {
    expect(extractWhile('xxabc', 2, 'abc')).toBe('abc');
  });

  test('stops at end of string', () => {
    expect(extractWhile('aaa', 0, 'a')).toBe('aaa');
  });

  test('returns empty when the first char is not allowed', () => {
    expect(extractWhile('!', 0, 'abc')).toBe('');
  });
});

describe('extractUntil', () => {
  test('consumes chars until one is in the stop set', () => {
    expect(extractUntil('hello world', 0, ' ')).toBe('hello');
  });

  test('runs to end of string when no stop char is found', () => {
    expect(extractUntil('hello', 0, ' ')).toBe('hello');
  });
});

describe('parseStringContent', () => {
  test('reads until the closing quote', () => {
    expect(parseStringContent('say "hi"', 0, '"')).toBe('say ');
  });

  test('skips an escaped quote inside the content', () => {
    expect(parseStringContent('a\\"b"', 0, '"')).toBe('a\\"b');
  });

  test('stops at end of string without a closing quote', () => {
    expect(parseStringContent('no quote here', 0, '"')).toBe('no quote here');
  });
});
