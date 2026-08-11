import { describe, test, expect } from 'bun:test';
import { collectString, collectStream } from './collect-stream.ts';

describe('collectString', () => {
  test('drains an async generator into a concatenated string', async () => {
    const stream = (async function* generate() { yield 'a'; yield 'b'; yield 'c'; })();
    expect(await collectString(stream)).toBe('abc');
  });

  test('returns empty string for an empty stream', async () => {
    const stream = (async function* generate() {})();
    expect(await collectString(stream)).toBe('');
  });

  test('preserves chunk order across awaited boundaries', async () => {
    const stream = (async function* generate() {
      yield '1-';
      await Promise.resolve();
      yield '2-';
      yield '3';
    })();
    expect(await collectString(stream)).toBe('1-2-3');
  });
});

describe('collectStream', () => {
  test('drains an async generator and captures return value', async () => {
    const stream = (async function* generate() {
      yield 'x';
      yield 'y';
      return { exported: 'context' };
    })();
    const result = await collectStream(stream);
    expect(result.output).toBe('xy');
    expect(result.context).toEqual({ exported: 'context' });
  });

  test('returns empty output with undefined context for empty generator', async () => {
    const stream = (async function* generate() { yield ''; return null; })();
    const result = await collectStream(stream);
    expect(result.output).toBe('');
    expect(result.context).toBeNull();
  });

  test('preserves chunk order and captures final context', async () => {
    const stream = (async function* generate() {
      yield 'a';
      await Promise.resolve();
      yield 'b';
      yield 'c';
      return 'final';
    })();
    const result = await collectStream(stream);
    expect(result.output).toBe('abc');
    expect(result.context).toBe('final');
  });
});
