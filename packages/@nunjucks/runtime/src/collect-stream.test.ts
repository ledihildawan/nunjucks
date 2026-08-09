import { describe, test, expect } from 'bun:test';
import { collectString } from './collect-stream.ts';

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
