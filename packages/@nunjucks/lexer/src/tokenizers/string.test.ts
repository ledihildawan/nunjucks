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

  test('escaped quote preserved literally', () => {
    expect(run('"a\\"b"')?.token.value).toBe('a\\"b');
  });

  test('contains other quote type', () => {
    expect(run('"it\'s"')?.token.value).toBe("it's");
  });
});
