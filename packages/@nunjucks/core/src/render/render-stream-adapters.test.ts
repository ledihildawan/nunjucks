import { describe, expect, test } from 'bun:test';
import { isErr, isOk } from '@nunjucks/lib';
import {
  coalesceStream,
  coerceChunk,
  isStreamTimeoutError,
  toWebReadableStream,
  withStreamDeadline,
  withStreamTimeout,
} from './render-stream-adapters.ts';

const fromChunks = (chunks: readonly string[], delayMs = 0): AsyncGenerator<string> =>
  (async function* generate() {
    for (const chunk of chunks) {
      if (delayMs > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, delayMs);
        });
      }
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
      if (done) {
        break;
      }
      collected.push(decoder.decode(value));
    }
    expect(collected.join('')).toBe('abc');
  });
});

describe('withStreamTimeout', () => {
  test('passes through chunks that arrive before the deadline', async () => {
    const chunks: string[] = [];
    // WHY: 1ms chunk delay vs 1000ms deadline — a ~1000x margin keeps this stable on
    // slow CI schedulers where setTimeout(5) can overshoot a 100ms idle window.
    for await (const chunk of withStreamTimeout(fromChunks(['x', 'y'], 1), 1000)) {
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
      for await (const _chunk of timed) {
        void _chunk;
      }
    } catch (error) {
      caught = error;
    }
    expect(isStreamTimeoutError(caught)).toBe(true);
  });
});

describe('withStreamDeadline', () => {
  test('completes normally when the source finishes before the total deadline', async () => {
    const chunks: string[] = [];
    for await (const chunk of withStreamDeadline(fromChunks(['a', 'b', 'c'], 1), 500)) {
      chunks.push(chunk);
    }
    expect(chunks.join('')).toBe('abc');
  });

  test('throws a StreamTimeoutError when the total deadline elapses mid-stream', async () => {
    // WHY: chunks arrive every 30ms but the total deadline is 50ms — the idle guard would pass, only the total deadline aborts.
    const stream = fromChunks(['x', 'y', 'z'], 30);
    let caught: unknown;
    try {
      for await (const _chunk of withStreamDeadline(stream, 50)) {
        void _chunk;
      }
    } catch (error) {
      caught = error;
    }
    expect(isStreamTimeoutError(caught)).toBe(true);
  });

  test('timeout error carries code=TIMEOUT so FATAL_STREAM_CODES recognizes it', async () => {
    let caught: unknown;
    try {
      for await (const _chunk of withStreamDeadline(fromChunks(['a', 'b'], 80), 20)) {
        void _chunk;
      }
    } catch (error) {
      caught = error;
    }
    expect((caught as { code?: string }).code).toBe('TIMEOUT');
  });
});

describe('coalesceStream', () => {
  test('threshold=0 is transparent — every chunk passes through untouched', async () => {
    const chunks: string[] = [];
    for await (const chunk of coalesceStream(fromChunks(['a', 'b', 'c']), 0)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['a', 'b', 'c']);
  });

  test('flushes the first chunk immediately then batches up to the threshold', async () => {
    const chunks: string[] = [];
    for await (const chunk of coalesceStream(fromChunks(['1', '22', '333', '4']), 3)) {
      chunks.push(chunk);
    }
    // WHY: first chunk '1' flushes immediately (progressive rendering); '22'+'333' batch (5 >= 3) flush; '4' flushes at end.
    expect(chunks).toEqual(['1', '22333', '4']);
  });

  test('flushes the remaining buffer at end even when below threshold', async () => {
    const chunks: string[] = [];
    for await (const chunk of coalesceStream(fromChunks(['head', 'a', 'b']), 10)) {
      chunks.push(chunk);
    }
    // WHY: 'head' first-flush; 'a'+'b' = 2 < 10 so they stay buffered until source ends, then flush as 'ab'.
    expect(chunks).toEqual(['head', 'ab']);
  });

  test('threshold=1 batches everything after the first chunk', async () => {
    const chunks: string[] = [];
    for await (const chunk of coalesceStream(fromChunks(['x', 'y', 'z']), 1)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['x', 'y', 'z']);
  });
});

describe('coerceChunk', () => {
  test('passes a primitive string through untouched', () => {
    const result = coerceChunk('hello');
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) {
      return;
    }
    expect(result.value).toBe('hello');
    expect(typeof result.value).toBe('string');
  });

  test('coerces a boxed String (SafeString-shaped) to a primitive string', () => {
    // WHY: regression for ERR_INVALID_ARG_TYPE — SafeString extends String (boxed). coerceChunk must produce a
    // primitive so HTTP sinks (res.write / TextEncoder.encode) accept the chunk.
    const boxed = new String('abc');
    expect(typeof boxed).toBe('object');
    const result = coerceChunk(boxed);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) {
      return;
    }
    expect(typeof result.value).toBe('string');
    expect(result.value).toBe('abc');
  });

  test('coerces a number to a string', () => {
    const result = coerceChunk(42);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) {
      return;
    }
    expect(result.value).toBe('42');
  });

  test('returns err on a Promise leak (fail-loud safety net for missing await at an emit site)', () => {
    // WHY: without this guard a leaked Promise would silently stringify to "[object Promise]". Returning err surfaces
    // the bug as a mid-stream error instead of corrupting the response.
    const result = coerceChunk(Promise.resolve('x'));
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) {
      return;
    }
    expect(result.error.message).toContain('Promise leaked');
  });
});
