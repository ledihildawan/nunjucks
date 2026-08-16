import { describe, test, expect } from 'bun:test';
import { Readable } from 'node:stream';
import { collectString, collectStream } from './collect-stream.ts';

describe('collectString', () => {
  test('concatenates all yielded chunks of a node readable', async () => {
    expect(await collectString(Readable.from(['a', 'b']))).toBe('ab');
  });

  test('concatenates chunks of an async generator in order', async () => {
    const letters = async function* (): AsyncGenerator<string> {
      yield 'nu';
      yield 'nj';
      yield 'ucks';
    };
    expect(await collectString(letters())).toBe('nunjucks');
  });

  test('returns an empty string for an empty stream', async () => {
    const empty = async function* (): AsyncGenerator<string> {};
    expect(await collectString(empty())).toBe('');
  });
});

describe('collectStream', () => {
  test('captures both the joined output and the return value', async () => {
    const stream = async function* (): AsyncGenerator<string, string> {
      yield 'a';
      yield 'b';
      return 'done';
    };
    expect(await collectStream(stream())).toEqual({ output: 'ab', returnValue: 'done' });
  });

  test('returns an undefined return value for a generator without one', async () => {
    const empty = async function* (): AsyncGenerator<string, undefined> {};
    expect(await collectStream(empty())).toEqual({ output: '', returnValue: undefined });
  });
});
