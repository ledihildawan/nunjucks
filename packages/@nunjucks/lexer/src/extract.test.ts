import { describe, expect, test } from 'bun:test';
import { decodeStringEscapes, extractUntil, extractWhile, parseStringContent } from './extract.ts';

describe('extractWhile', () => {
  test('consumes chars while they are in the allowed set', () => {
    expect(extractWhile({ source: 'abc123!', start: 0, allowed: new Set('abc') })).toBe('abc');
  });

  test('starts from the given index', () => {
    expect(extractWhile({ source: 'xxabc', start: 2, allowed: new Set('abc') })).toBe('abc');
  });

  test('stops at end of string', () => {
    expect(extractWhile({ source: 'aaa', start: 0, allowed: new Set('a') })).toBe('aaa');
  });

  test('returns empty when the first char is not allowed', () => {
    expect(extractWhile({ source: '!', start: 0, allowed: new Set('abc') })).toBe('');
  });
});

describe('extractUntil', () => {
  test('consumes chars until one is in the stop set', () => {
    expect(extractUntil({ source: 'hello world', start: 0, terminators: new Set(' ') })).toBe(
      'hello'
    );
  });

  test('runs to end of string when no stop char is found', () => {
    expect(extractUntil({ source: 'hello', start: 0, terminators: new Set(' ') })).toBe('hello');
  });
});

describe('parseStringContent', () => {
  test('reads until the closing quote', () => {
    expect(parseStringContent({ source: 'say "hi"', start: 0, quote: '"' })).toBe('say ');
  });

  test('skips an escaped quote inside the content', () => {
    expect(parseStringContent({ source: 'a\\"b"', start: 0, quote: '"' })).toBe('a\\"b');
  });

  test('stops at end of string without a closing quote', () => {
    expect(parseStringContent({ source: 'no quote here', start: 0, quote: '"' })).toBe(
      'no quote here'
    );
  });
});

describe('decodeStringEscapes', () => {
  test('decodes \\n \\t \\r to real control characters', () => {
    expect(decodeStringEscapes('a\\nb')).toBe('a\nb');
    expect(decodeStringEscapes('a\\tb')).toBe('a\tb');
    expect(decodeStringEscapes('a\\rb')).toBe('a\rb');
  });

  test('decapes escaped quotes and backslashes to the bare character', () => {
    expect(decodeStringEscapes('a\\"b')).toBe('a"b');
    expect(decodeStringEscapes("don\\'t")).toBe("don't");
    expect(decodeStringEscapes('a\\\\b')).toBe('a\\b');
  });

  test('drops the backslash for any other escape, keeping the character', () => {
    expect(decodeStringEscapes('a\\qb')).toBe('aqb');
  });

  test('leaves plain text untouched', () => {
    expect(decodeStringEscapes('plain text')).toBe('plain text');
  });

  test('keeps a dangling trailing backslash', () => {
    expect(decodeStringEscapes('abc\\')).toBe('abc\\');
  });
});
