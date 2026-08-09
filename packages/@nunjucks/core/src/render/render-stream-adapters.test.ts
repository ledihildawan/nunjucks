import { describe, test, expect } from 'bun:test';
import { toWebReadableStream, withStreamTimeout, isStreamTimeoutError } from './render-stream-adapters.ts';

const fromChunks = (chunks: readonly string[], delayMs = 0): AsyncGenerator<string> =>
  (async function* generate() {
    for (const chunk of chunks) {
      if (delayMs > 0) { await new Promise((resolve) => { setTimeout(resolve, delayMs); }); }
      yield chunk;
    }
  })();

describe('toWebReadableStream', () => {
  test('converts an async generator into a Web ReadableStream of bytes', async () => {
    const readable = toWebReadableStream(fromChunks(['a', 'b', 'c']));
    const reader = readable.getReader();
    const decoder = new TextDecoder();
    const collected: string[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) { break; }
      collected.push(decoder.decode(value));
    }
    expect(collected.join('')).toBe('abc');
  });
});

describe('withStreamTimeout', () => {
  test('passes through chunks that arrive before the deadline', async () => {
    const chunks: string[] = [];
    for await (const chunk of withStreamTimeout(fromChunks(['x', 'y'], 5), 100)) {
      chunks.push(chunk);
    }
    expect(chunks.join('')).toBe('xy');
  });

  test('throws a StreamTimeoutError when a chunk exceeds the deadline', async () => {
    const stream = fromChunks(['fast', 'slow'], 60);
    const first = await stream.next();
    expect(first.value).toBe('fast');

    const timed = withStreamTimeout(stream, 20);
    let caught: unknown;
    try {
      for await (const _chunk of timed) { void _chunk; }
    } catch (error) {
      caught = error;
    }
    expect(isStreamTimeoutError(caught)).toBe(true);
  });
});
