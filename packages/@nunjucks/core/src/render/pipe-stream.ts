import type { RenderStreamResult } from './render-types.ts';
import { withStreamTimeout } from './render-stream-adapters.ts';
import { formatError, type TemplateError } from '@nunjucks/log';
import { formatErrorMarker } from './render.ts';

// WHY: structural sink interface matching Express Response shape — res.status(), res.setHeader(), res.write(), res.end(), res.flushHeaders(). Express res satisfies this directly; Bun/Deno/Web can adapt (flushHeaders is optional — without it, chunks may buffer but still arrive).
interface PipeSink {
  status: (code: number) => void;
  setHeader: (name: string, value: string) => void;
  // biome-ignore lint/suspicious/noConfusingVoidType: Express write() returns boolean, but custom sinks may return void — both must be accepted.
  write: (chunk: string) => boolean | Promise<boolean> | void;
  end: () => void;
  flushHeaders?: () => void;
  onClose?: () => void;
  on?: (event: string, listener: () => void) => void;
}

interface PipeRenderStreamOptions {
  contentType?: 'html' | 'json' | 'text';
  dev?: boolean;
  timeoutMs?: number;
  ide?: string;
  logError?: boolean;
  signal?: AbortSignal;
  onChunk?: (chunk: string, index: number) => void;
  onError?: (error: Error | TemplateError, phase: 'pre-stream' | 'mid-stream') => void;
  onComplete?: (stats: { chunks: number; errors: number; bytes: number }) => void;
}

const CONTENT_TYPE_MAP: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  json: 'application/json; charset=utf-8',
  text: 'text/plain; charset=utf-8',
};

interface RenderErrorInput {
  err: TemplateError;
  contentType: string;
  dev: boolean;
  ide: string | undefined;
}

const renderPreStreamError = ({ err, contentType, dev, ide }: RenderErrorInput): string => {
  if (contentType === 'json') {
    return JSON.stringify({ error: true, code: err.code, message: err.message, templatePath: err.templatePath, lineno: err.lineno, colno: err.colno });
  }
  return formatError(err, { format: contentType as 'html' | 'ansi' | 'text', dev, ide });
};

interface MidStreamErrorInput {
  err: unknown;
  contentType: string;
  ide: string;
}

const renderMidStreamError = ({ err, contentType, ide }: MidStreamErrorInput): string => {
  const error = err as TemplateError;
  if (contentType === 'json') {
    return `\n${JSON.stringify({ error: true, code: error.code, message: error.message, templatePath: error.templatePath, lineno: error.lineno, colno: error.colno })}`;
  }
  if (contentType === 'text') {
    return `\n[render error] ${error.message} at ${error.templatePath ?? 'unknown'}:${error.lineno ?? '?'}:${error.colno ?? '?'}`;
  }
  return formatErrorMarker(error, { ide, contentType });
};

const waitForDrain = (sink: PipeSink): Promise<void> =>
  new Promise((resolve) => {
    if (sink.on) {
      sink.on('drain', resolve);
    } else {
      resolve();
    }
  });

const pipeChunks = async (
  stream: AsyncGenerator<string>,
  sink: PipeSink,
  signal: AbortSignal | undefined,
  onChunk: ((chunk: string, index: number) => void) | undefined,
  stats: { chunks: number; bytes: number }
): Promise<void> => {
  for await (const chunk of stream) {
    if (signal?.aborted) { break; }
    onChunk?.(chunk, stats.chunks);
    stats.chunks += 1;
    stats.bytes += chunk.length;
    const writeResult = sink.write(chunk);
    if (writeResult === false) {
      await waitForDrain(sink);
    }
  }
};

// WHY: pipeRenderStream encapsulates the full streaming lifecycle — pre-stream error (full page), success (pipe chunks), mid-stream error (inline marker) — with backpressure handling (await drain when write returns false), client disconnect detection (AbortSignal), and content-type-aware error rendering.
const pipeRenderStream = async (
  result: RenderStreamResult,
  sink: PipeSink,
  options: PipeRenderStreamOptions = {}
): Promise<void> => {
  const { contentType = 'html', dev = false, timeoutMs = 0, ide = 'vscode', logError = dev, signal, onChunk, onError, onComplete } = options;
  const mimeType = CONTENT_TYPE_MAP[contentType] ?? 'text/html; charset=utf-8';
  const stats = { chunks: 0, bytes: 0 };
  let errorCount = 0;

  if (signal?.aborted) {
    sink.end();
    onComplete?.({ ...stats, errors: 0 });
    return;
  }

  if (!result.ok) {
    errorCount += 1;
    if (logError) {
      // biome-ignore lint/suspicious/noConsole: intentional server-side ANSI error logging for dev debugging
      console.log(formatError(result.error, { format: 'ansi', dev }));
    }
    onError?.(result.error, 'pre-stream');
    sink.status(500);
    sink.setHeader('Content-Type', mimeType);
    sink.write(renderPreStreamError({ err: result.error, contentType, dev, ide }));
    sink.end();
    onComplete?.({ ...stats, errors: errorCount });
    return;
  }

  sink.setHeader('Content-Type', mimeType);
  sink.setHeader('X-Accel-Buffering', 'no');
  sink.setHeader('Cache-Control', 'no-cache, no-transform');
  sink.flushHeaders?.();

  const stream = timeoutMs > 0 ? withStreamTimeout(result.stream, timeoutMs) : result.stream;

  const onAbort = (): void => { stream.return?.(undefined); };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    await pipeChunks(stream, sink, signal, onChunk, stats);
    if (!signal?.aborted) {
      sink.end();
    }
  } catch (streamErr) {
    if (signal?.aborted) {
      sink.end();
    } else {
      errorCount += 1;
      if (logError) {
        // biome-ignore lint/suspicious/noConsole: intentional server-side ANSI error logging for dev debugging
        console.log(formatError(streamErr as Error, { format: 'ansi', dev }));
      }
      onError?.(streamErr as Error, 'mid-stream');
      sink.write(renderMidStreamError({ err: streamErr, contentType, ide }));
      sink.end();
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    sink.onClose?.();
    onComplete?.({ ...stats, errors: errorCount });
  }
};

export { pipeRenderStream };
export type { PipeSink, PipeRenderStreamOptions };
