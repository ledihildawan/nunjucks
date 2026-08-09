import { describe, test, expect } from 'bun:test';
import { renderToStream, pipeRenderStream, type PipeSink } from '@nunjucks/core';

const createMockSink = (): { sink: PipeSink; writes: string[]; status: number | null; headers: Record<string, string>; ended: boolean } => {
  const writes: string[] = [];
  const headers: Record<string, string> = {};
  let status: number | null = null;
  let ended = false;
  return {
    sink: {
      setStatus: (code: number) => { status = code; },
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
    const result = await renderToStream('{{ unclosed', {});

    await pipeRenderStream(result, mock.sink, { dev: true });

    expect(mock.status).toBe(500);
    expect(mock.headers['Content-Type']).toContain('text/html');
    expect(mock.writes[0]).toContain('Template');
    expect(mock.ended).toBe(true);
  });

  test('successful stream → pipes all chunks + ends', async () => {
    const mock = createMockSink();
    const result = await renderToStream('Hello {{ name }}!', { context: { name: 'World' } });

    await pipeRenderStream(result, mock.sink, { dev: true });

    expect(mock.status).toBeNull();
    expect(mock.headers['Content-Type']).toContain('text/html');
    expect(mock.headers['X-Accel-Buffering']).toBe('no');
    expect(mock.writes.join('')).toBe('Hello World!');
    expect(mock.ended).toBe(true);
  });

  test('mid-stream error → appends marker fragment + ends', async () => {
    const mock = createMockSink();
    const result = await renderToStream('OK {{ bad.missing }}', { context: { bad: {} }, undefined: 'strict' });

    await pipeRenderStream(result, mock.sink, { dev: true });

    expect(mock.headers['Content-Type']).toContain('text/html');
    const output = mock.writes.join('');
    expect(output).toContain('OK ');
    expect(output).toContain('nj-err-block');
    expect(output).toContain('nj-err-overlay');
    expect(mock.ended).toBe(true);
  });

  test('text contentType → plain text error for mid-stream', async () => {
    const mock = createMockSink();
    const result = await renderToStream('OK {{ bad.missing }}', { context: { bad: {} }, undefined: 'strict' });

    await pipeRenderStream(result, mock.sink, { contentType: 'text', dev: true });

    const output = mock.writes.join('');
    expect(output).toContain('OK ');
    expect(output).toContain('[render error]');
    expect(output).not.toContain('nj-err-mark');
  });
});
