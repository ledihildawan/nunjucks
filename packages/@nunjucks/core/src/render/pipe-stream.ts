import type { RenderStreamResult } from './render-types.ts';
import { withStreamTimeout } from './render-stream-adapters.ts';
import { formatError, type TemplateError } from '@nunjucks/log';
import { formatErrorMarker } from './render.ts';

// WHY: structural sink interface matching Express Response shape — res.status(), res.setHeader(), res.write(), res.end(), res.flushHeaders(). Express res satisfies this directly; Bun/Deno/Web can adapt (flushHeaders is optional — without it, chunks may buffer but still arrive).
interface PipeSink {
  status: (code: number) => void;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => void | Promise<void>;
  end: () => void;
  flushHeaders?: () => void;
}

interface PipeRenderStreamOptions {
  contentType?: 'html' | 'json' | 'text';
  dev?: boolean;
  timeoutMs?: number;
  ide?: string;
  logError?: boolean;
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
  return formatErrorMarker(error, ide);
};

// WHY: pipeRenderStream encapsulates the full streaming lifecycle — pre-stream error (full page), success (pipe chunks), mid-stream error (inline marker) — so the consumer writes 1 line instead of 25 lines of boilerplate. Handles Content-Type, headers, timeout, ANSI logging, and content-type-aware error rendering internally.
const pipeRenderStream = async (
  result: RenderStreamResult,
  sink: PipeSink,
  options: PipeRenderStreamOptions = {}
): Promise<void> => {
  const { contentType = 'html', dev = false, timeoutMs = 0, ide = 'vscode', logError = dev } = options;
  const mimeType = CONTENT_TYPE_MAP[contentType] ?? 'text/html; charset=utf-8';

  if (!result.ok) {
    if (logError) {
      // biome-ignore lint/suspicious/noConsole: intentional server-side ANSI error logging for dev debugging
      console.log(formatError(result.error, { format: 'ansi', dev }));
    }
    sink.status(500);
    sink.setHeader('Content-Type', mimeType);
    sink.write(renderPreStreamError({ err: result.error, contentType, dev, ide }));
    sink.end();
    return;
  }

  sink.setHeader('Content-Type', mimeType);
  sink.setHeader('X-Accel-Buffering', 'no');
  sink.setHeader('Cache-Control', 'no-cache, no-transform');
  sink.flushHeaders?.();

  const stream = timeoutMs > 0 ? withStreamTimeout(result.stream, timeoutMs) : result.stream;

  try {
    for await (const chunk of stream) {
      sink.write(chunk);
    }
    sink.end();
  } catch (streamErr) {
    if (logError) {
      // biome-ignore lint/suspicious/noConsole: intentional server-side ANSI error logging for dev debugging
      console.log(formatError(streamErr as Error, { format: 'ansi', dev }));
    }
    sink.write(renderMidStreamError({ err: streamErr, contentType, ide }));
    sink.end();
  }
};

export { pipeRenderStream };
export type { PipeSink, PipeRenderStreamOptions };
