import { describe, test, expect } from 'bun:test';
import { nunjucks, type PipeSink } from '@nunjucks/core';

const njk = nunjucks({});
const strictNjk = nunjucks({ undefined: 'strict' });

const createMockSink = (): { sink: PipeSink; writes: string[]; status: number | null; headers: Record<string, string>; ended: boolean } => {
  const writes: string[] = [];
  const headers: Record<string, string> = {};
  let status: number | null = null;
  let ended = false;
  return {
    sink: {
      status: (code: number) => { status = code; },
      setHeader: (name: string, value: string) => { headers[name] = value; },
      write: (chunk: string) => { writes.push(chunk); },
      end: () => { ended = true; },
    },
    get writes() { return writes; },
    get status() { return status; },
    get headers() { return headers; },
    get ended() { return ended; },
  };
};

describe('pipeRenderStream', () => {
  test('pre-stream error → status 500 + full error page', async () => {
    const mock = createMockSink();
    const result = await njk.renderToStream('{{ unclosed');

    await njk.pipeRenderStream(result, mock.sink, { dev: true });

    expect(mock.status).toBe(500);
    expect(mock.headers['Content-Type']).toContain('text/html');
    expect(mock.writes[0]).toContain('Template');
    expect(mock.ended).toBe(true);
  });

  test('successful stream → pipes all chunks + ends', async () => {
    const mock = createMockSink();
    const result = await njk.renderToStream('Hello {{ name }}!', { name: 'World' });

    await njk.pipeRenderStream(result, mock.sink, { dev: true });

    expect(mock.status).toBeNull();
    expect(mock.headers['Content-Type']).toContain('text/html');
    expect(mock.headers['X-Accel-Buffering']).toBe('no');
    expect(mock.writes.join('')).toBe('Hello World!');
    expect(mock.ended).toBe(true);
  });

  test('mid-stream error → appends marker fragment + ends', async () => {
    const mock = createMockSink();
    const result = await strictNjk.renderToStream('OK {{ bad.missing }}', { bad: {} });

    await njk.pipeRenderStream(result, mock.sink, { dev: true });

    expect(mock.headers['Content-Type']).toContain('text/html');
    const output = mock.writes.join('');
    expect(output).toContain('OK ');
    expect(output).toContain('nj-err-block');
    expect(output).toContain('nj-err-overlay');
    expect(mock.ended).toBe(true);
  });

  test('text contentType → plain text error for mid-stream', async () => {
    const mock = createMockSink();
    const result = await strictNjk.renderToStream('OK {{ bad.missing }}', { bad: {} });

    await njk.pipeRenderStream(result, mock.sink, { contentType: 'text', dev: true });

    const output = mock.writes.join('');
    expect(output).toContain('OK ');
    expect(output).toContain('[render error]');
    expect(output).not.toContain('nj-err-mark');
  });

  test('client abort stops the stream and completes (cleanup cascade)', async () => {
    // WHY: a template that yields incrementally lets us abort between chunks. After abort, no further chunks
    // are written, the sink is finalized (end), and onComplete fires — proving the abort listener + .return()
    // cascade terminated the stream cleanly rather than leaking an open response.
    const controller = new AbortController();
    const mock = createMockSink();
    const result = await njk.renderToStream('a{{ b }}c{{ d }}e', { b: 'B', d: 'D' });
    let completeStats: { chunks: number; errors: number; bytes: number } | null = null;
    let chunkIndex = 0;
    await njk.pipeRenderStream(result, mock.sink, {
      signal: controller.signal,
      onChunk: () => {
        chunkIndex += 1;
        if (chunkIndex === 1) { controller.abort(); }
      },
      onComplete: (stats) => { completeStats = stats; },
    });
    expect(mock.writes.join('')).toBe('a');
    expect(mock.ended).toBe(true);
    expect(completeStats).not.toBeNull();
  });

  test('backpressure — awaits a Promise<boolean> write and waits for drain on false', async () => {
    // WHY: regression guard for the F2a fix. Previously a Promise<boolean> was not awaited (treated as truthy),
    // so false backpressure was ignored. Now false triggers waitForDrain; the sink emits 'drain' to release it.
    let drainListener: (() => void) | null = null;
    const localWrites: string[] = [];
    let writeCount = 0;
    const sink: PipeSink = {
      status: () => {},
      setHeader: () => {},
      write: (chunk: string): Promise<boolean> => {
        localWrites.push(chunk);
        writeCount += 1;
        if (writeCount === 1) {
          // WHY: first write signals backpressure; emit drain asynchronously so waitForDrain resolves.
          setTimeout(() => { drainListener?.(); }, 5);
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      },
      end: () => {},
      on: (_event: string, listener: () => void) => { drainListener = listener; },
      off: () => { drainListener = null; },
    };
    const result = await njk.renderToStream('a{{ b }}c', { b: 'B' });
    await njk.pipeRenderStream(result, sink, {});
    expect(localWrites.join('')).toBe('aBc');
  });

  test('maxOutputSize circuit breaker throws OUTPUT_SIZE_EXCEEDED mid-stream', async () => {
    // WHY: a loop producing output past the limit trips the breaker; the error rides the Tier 3 mid-stream path
    // (status stays 200 since headers flushed, but the marker fragment carries the OUTPUT_SIZE_EXCEEDED code).
    const mock = createMockSink();
    const result = await njk.renderToStream('{% for i in [1,2,3,4,5] %}{{ i }}{% endfor %}');
    await njk.pipeRenderStream(result, mock.sink, { maxOutputSize: 3, contentType: 'json', dev: true });
    const output = mock.writes.join('');
    expect(output).toContain('OUTPUT_SIZE_EXCEEDED');
    expect(mock.ended).toBe(true);
  });
});
