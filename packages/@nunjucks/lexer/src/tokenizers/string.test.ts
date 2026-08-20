import { describe, expect, test } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeString } from './string.ts';

const run = (src: string) => tokenizeString({ ...createState(src), inCode: true });

describe('tokenizeString', () => {
  test('returns null for non-quote', () => {
    expect(run('abc')).toBeNull();
  });

  test('double-quoted', () => {
    const r = run('"hello"');
    expect(r?.token.type).toBe('string');
    expect(r?.token.value).toBe('hello');
  });

  test('single-quoted', () => {
    const r = run("'world'");
    expect(r?.token.value).toBe('world');
  });

  test('empty string', () => {
    expect(run('""')?.token.value).toBe('');
  });

  test('escaped quote decodes to the bare quote', () => {
    // WHY: updated from the raw-backslash pin — the original lexer's `_parseString`
    // decapces `\"` to `"`, and the tokenizer now decodes escapes into the token value.
    expect(run('"a\\"b"')?.token.value).toBe('a"b');
  });

  test('control escapes decode to real control characters', () => {
    expect(run('"a\\nb"')?.token.value).toBe('a\nb');
    expect(run('"a\\tb"')?.token.value).toBe('a\tb');
    expect(run('"a\\rb"')?.token.value).toBe('a\rb');
  });

  test('escaped backslash decodes to a single backslash', () => {
    expect(run('"a\\\\b"')?.token.value).toBe('a\\b');
  });

  test('unknown escape drops the backslash keeping the character', () => {
    expect(run('"a\\qb"')?.token.value).toBe('aqb');
  });

  test('escaped single quote inside single-quoted string decodes', () => {
    expect(run("'don\\'t'")?.token.value).toBe("don't");
  });

  test('contains other quote type', () => {
    expect(run('"it\'s"')?.token.value).toBe("it's");
  });

  test('unterminated string throws UNTERMINATED_LITERAL', () => {
    expect(() => run('"no close')).toThrow(/Unterminated string literal/);
  });

  test('string ending on a trailing escape throws UNTERMINATED_LITERAL', () => {
    expect(() => run("'abc\\")).toThrow(/Unterminated string literal/);
  });
});
