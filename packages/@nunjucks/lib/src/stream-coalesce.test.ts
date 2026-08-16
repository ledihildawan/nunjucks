import { describe, test, expect } from 'bun:test';
import { coalesceStream } from './stream-coalesce.ts';

const sourceOf = async function* (chunks: readonly string[]): AsyncGenerator<string> {
  yield* chunks;
};

const drainInto = async (stream: AsyncGenerator<string>): Promise<string[]> => {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
};

describe('coalesceStream', () => {
  test('passes every chunk through unchanged at the default threshold', async () => {
    expect(await drainInto(coalesceStream(sourceOf(['a', 'bb', 'ccc'])))).toEqual(['a', 'bb', 'ccc']);
  });

  test('passes every chunk through unchanged at threshold zero', async () => {
    expect(await drainInto(coalesceStream(sourceOf(['x', 'y']), 0))).toEqual(['x', 'y']);
  });

  test('flushes the first chunk immediately and batches the rest to the threshold', async () => {
    expect(await drainInto(coalesceStream(sourceOf(['first', 'a', 'b', 'c']), 3))).toEqual([
      'first',
      'abc',
    ]);
  });

  test('flushes the buffered remainder once the stream ends', async () => {
    expect(await drainInto(coalesceStream(sourceOf(['first', 'a', 'b']), 3))).toEqual([
      'first',
      'ab',
    ]);
  });

  test('emits nothing for an empty stream', async () => {
    expect(await drainInto(coalesceStream(sourceOf([]), 4))).toEqual([]);
  });

  test('flushes a single short chunk immediately as the first write', async () => {
    expect(await drainInto(coalesceStream(sourceOf(['only']), 5))).toEqual(['only']);
  });
});
