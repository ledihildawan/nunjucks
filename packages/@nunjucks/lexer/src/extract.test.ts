import { describe, test, expect } from 'bun:test';
import { extractWhile, extractUntil, parseStringContent } from './extract.ts';

describe('extractWhile', () => {
  test('consumes chars while they are in the allowed set', () => {
    expect(extractWhile({ str: 'abc123!', start: 0, chars: 'abc' })).toBe('abc');
  });

  test('starts from the given index', () => {
    expect(extractWhile({ str: 'xxabc', start: 2, chars: 'abc' })).toBe('abc');
  });

  test('stops at end of string', () => {
    expect(extractWhile({ str: 'aaa', start: 0, chars: 'a' })).toBe('aaa');
  });

  test('returns empty when the first char is not allowed', () => {
    expect(extractWhile({ str: '!', start: 0, chars: 'abc' })).toBe('');
  });
});

describe('extractUntil', () => {
  test('consumes chars until one is in the stop set', () => {
    expect(extractUntil({ str: 'hello world', start: 0, chars: ' ' })).toBe('hello');
  });

  test('runs to end of string when no stop char is found', () => {
    expect(extractUntil({ str: 'hello', start: 0, chars: ' ' })).toBe('hello');
  });
});

describe('parseStringContent', () => {
  test('reads until the closing quote', () => {
    expect(parseStringContent({ str: 'say "hi"', start: 0, quote: '"' })).toBe('say ');
  });

  test('skips an escaped quote inside the content', () => {
    expect(parseStringContent({ str: 'a\\"b"', start: 0, quote: '"' })).toBe('a\\"b');
  });

  test('stops at end of string without a closing quote', () => {
    expect(parseStringContent({ str: 'no quote here', start: 0, quote: '"' })).toBe('no quote here');
  });
});
