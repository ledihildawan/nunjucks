import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { ErrorContext, TemplateError } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { formatError } from '@nunjucks/error-formatter/format';
import { isErr } from '@nunjucks/lib';
import type { ContentType } from '@nunjucks/shared';
import { formatErrorMarker } from './render-stream.ts';
import type { RenderMarkerError, RenderStreamResult } from './render-types.ts';
import { writeErrorLog } from './shell/console-error-sink.ts';
import { coalesceStream, withStreamTimeout } from './shell/render-stream-adapters.ts';

// WHY: structural sink interface matching Express Response shape — res.status(), res.setHeader(), res.write(), res.end(), res.flushHeaders(). Express res satisfies this directly; Bun/Deno/Web can adapt (flushHeaders is optional — without it, chunks may buffer but still arrive). `off` mirrors EventEmitter.off/removeListener and is used by waitForDrain to detach its one-shot drain listener (anti-leak); Express res provides it natively.
interface PipeSink {
  status: (code: number) => void;
  setHeader: (name: string, value: string) => void;
  // biome-ignore lint/suspicious/noConfusingVoidType: Express write() returns boolean, but custom sinks may return void — both must be accepted. ALL three return shapes are honored by pipeChunks: a Promise<boolean> is awaited (backpressure), false triggers waitForDrain, true/void continues immediately.
  write: (chunk: string) => boolean | Promise<boolean> | void;
  end: () => void;
  flushHeaders?: () => void;
  onClose?: () => void;
  on?: (event: string, listener: () => void) => void;
  off?: (event: string, listener: () => void) => void;
}

/** Options for `pipeRenderStream` — content type, dev flags, limits, and lifecycle hooks. */
interface PipeRenderStreamOptions {
  contentType?: ContentType;
  dev?: boolean;
  timeoutMs?: number;
  coalesceBytes?: number;
  maxOutputSize?: number;
  ide?: string;
  version?: string;
  logError?: boolean;
  signal?: AbortSignal;
  onChunk?: (chunk: string, index: number) => void;
  onError?: (error: Error | TemplateError, phase: 'pre-stream' | 'mid-stream') => void;
  onComplete?: (stats: { chunks: number; errors: number; bytes: number }) => void;
}

interface EmitErrorLogInput {
  error: Error | TemplateError;
  phase: 'pre-stream' | 'mid-stream';
  logError: boolean;
  dev: boolean;
  onError: PipeRenderStreamOptions['onError'];
}

// WHY: centralizes dev-gated error logging. When onError is provided, it is called (the caller owns logging). When onError is absent, the shell console sink is used as fallback — preserving exact previous behavior when no hook is registered.
const emitErrorLog = ({ error, phase, logError, dev, onError }: EmitErrorLogInput): void => {
  if (onError) {
    onError(error, phase);
  } else if (logError) {
    writeErrorLog({ error: redactForLog(error as TemplateError), dev });
  }
};

const CONTENT_TYPE_MAP: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  json: 'application/json; charset=utf-8',
  text: 'text/plain; charset=utf-8',
};

/** Serializes a marker error to its JSON wire shape for `json` content-type responses. */
const serializeErrorPayload = (error: RenderMarkerError): string =>
  JSON.stringify({
    error: true,
    code: error.code,
    message: error.message,
    templatePath: error.templatePath,
    lineno: error.lineno,
    colno: error.colno,
  });

export { serializeErrorPayload };

interface RenderErrorInput {
  err: TemplateError;
  contentType: ContentType;
  dev: boolean;
  ide: string | undefined;
}

const renderPreStreamError = ({ err, contentType, dev, ide }: RenderErrorInput): string => {
  if (contentType === 'json') {
    return serializeErrorPayload(err);
  }
  // WHY: the json early-return above narrows contentType to 'html' | 'text' — both valid
  // formatError formats, so no cast is needed and drift is impossible by construction.
  return formatError(err, { format: contentType, dev, ide });
};

interface MidStreamErrorInput {
  err: unknown;
  contentType: ContentType;
  ide: string;
  version: string | undefined;
  dev: boolean;
}

// WHY: mid-stream errors are caught as `unknown` — anything can cross the throw boundary
// (catalogued TemplateError, plain Error, or a thrown primitive). Normalize so a non-Error
// never reaches formatErrorMarker/emitErrorLog with a lying static type.
const toErrorLike = (err: unknown): Error => (err instanceof Error ? err : new Error(String(err)));

const renderMidStreamError = ({
  err,
  contentType,
  ide,
  version,
  dev,
}: MidStreamErrorInput): string =>
  formatErrorMarker(toErrorLike(err), { ide, contentType, version, dev });

// WHY: shallow-clone a TemplateError with renderContext stripped before it reaches the dev ANSI log. renderContext holds the user's render data (potentially PII/secrets) and the ANSI renderer echoes it verbatim — the original error keeps renderContext for response formatting (where blockedKeys + dev gating apply), but the server log must not leak it. message/stack are non-enumerable on Error so they are set explicitly; all other catalog fields ride through Object.assign.
const redactForLog = (error: TemplateError): TemplateError => {
  if (error.renderContext === undefined) {
    return error;
  }
  const clone = new Error(error.message) as TemplateError;
  // WHY: descriptor definition instead of Object.assign — mid-stream errors cross the
  // throw boundary as `unknown`; an own enumerable "__proto__" on the source would be
  // forwarded to the prototype setter by [[Set]] and retarget this clone.
  Object.defineProperties(clone, Object.getOwnPropertyDescriptors({ ...error }));
  clone.stack = error.stack;
  clone.renderContext = undefined;
  return clone;
};

// WHY: builds a TemplateError (code=OUTPUT_SIZE_EXCEEDED) for the circuit breaker. Thrown from pipeChunks into pipeRenderStream's catch, where it rides the Tier 3 mid-stream path (log + onError + formatErrorMarker + end).
const createOutputSizeError = (maxOutputSize: number): TemplateError =>
  createLog('error', {
    def: {
      ...ERROR_DEFINITIONS.OUTPUT_SIZE_EXCEEDED,
      message: () => `Rendered output exceeds maximum size of ${maxOutputSize} bytes`,
    },
    params: {},
    subject: null,
    context: {
      lineno: null,
      colno: null,
      phase: 'render',
      templateName: null,
      templatePath: null,
      sourceStartLine: 1,
      lineBase: 'zero',
    } as ErrorContext,
  });

// WHY: resolves when the sink emits 'drain' OR the abort signal fires (whichever first), then detaches BOTH listeners via `off` so no listener accumulates across backpressure cycles. Previously each cycle added a permanent 'drain' listener and, if the sink never drained, the promise hung forever. The signal race gives an escape on client disconnect.
const waitForDrain = (sink: PipeSink, signal: AbortSignal | undefined): Promise<void> =>
  new Promise((resolve) => {
    if (!sink.on) {
      resolve();
      return;
    }
    const handleDrain = (): void => {
      finish();
    };
    const handleAbort = (): void => {
      finish();
    };
    const finish = (): void => {
      sink.off?.('drain', handleDrain);
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    };
    sink.on('drain', handleDrain);
    signal?.addEventListener('abort', handleAbort, { once: true });
    if (signal?.aborted) {
      finish();
    }
  });

interface PipeChunksInput {
  stream: AsyncGenerator<string>;
  sink: PipeSink;
  signal: AbortSignal | undefined;
  onChunk: ((chunk: string, index: number) => void) | undefined;
  stats: { chunks: number; bytes: number };
  maxOutputSize: number;
}

// WHY: for-await over the stream is permitted (Rule 3 — async stream-processing control flow). The input object satisfies Rule 4 (≥3 inputs → options object) instead of a 6-arg positional signature.
const pipeChunks = async ({
  stream,
  sink,
  signal,
  onChunk,
  stats,
  maxOutputSize,
}: PipeChunksInput): Promise<void> => {
  for await (const chunk of stream) {
    if (signal?.aborted) {
      break;
    }
    onChunk?.(chunk, stats.chunks);
    stats.chunks += 1;
    stats.bytes += chunk.length;
    if (maxOutputSize > 0 && stats.bytes > maxOutputSize) {
      throw createOutputSizeError(maxOutputSize);
    }
    // WHY: await so a Promise<boolean> sink is honored (true/false awaited), not just a sync boolean. void/undefined write resolves immediately and continues.
    const writeResult = await sink.write(chunk);
    if (writeResult === false) {
      await waitForDrain(sink, signal);
    }
  }
};

// WHY: pipeRenderStream encapsulates the full streaming lifecycle — pre-stream error (full page), success (pipe chunks), mid-stream error (inline marker) — with backpressure handling (await drain when write returns false), client disconnect detection (AbortSignal), and content-type-aware error rendering.
const pipeRenderStream = async (
  result: RenderStreamResult,
  sink: PipeSink,
  options: PipeRenderStreamOptions = {}
): Promise<void> => {
  const {
    contentType = 'html',
    dev = false,
    timeoutMs = 0,
    coalesceBytes = 0,
    maxOutputSize = 0,
    ide = 'vscode',
    version,
    logError = dev,
    signal,
    onChunk,
    onError,
    onComplete,
  } = options;
  const mimeType = CONTENT_TYPE_MAP[contentType] ?? 'text/html; charset=utf-8';
  const stats = { chunks: 0, bytes: 0 };
  let errorCount = 0;

  // WHY: one try/finally owns the whole lifecycle — the early-abort and pre-stream
  // paths previously skipped onClose (and onComplete when onError itself threw),
  // leaving the response un-finalized (the exact leak class the mid-stream finally
  // was added to prevent). sink.end() is idempotent, so double-calls are harmless.
  const onAbort = (): void => {
    streamToPipe?.return?.(undefined);
  };
  let streamToPipe: AsyncGenerator<string> | undefined;
  try {
    if (signal?.aborted) {
      sink.end();
      return;
    }

    if (isErr(result)) {
      errorCount += 1;
      emitErrorLog({ error: result.error, phase: 'pre-stream', logError, dev, onError });
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

    // WHY: wrapper composition is order-sensitive and cleanup-critical. The chain is (outer→inner): coalesceStream → withStreamTimeout → createRenderStream → executeStream. An external .return() (abort via onAbort below) hits coalesceStream first; for-await-of forwards .return() to withStreamTimeout, whose try/finally clears its timer and best-effort returns createRenderStream, whose try/finally returns executeStream. Every wrapper MUST therefore propagate .return() — that is the cleanup contract that prevents zombie generators. If a wrapper is skipped (timeoutMs=0 or coalesceBytes=0) the chain still terminates at createRenderStream, which owns the authoritative finally.
    streamToPipe = timeoutMs > 0 ? withStreamTimeout(result.value, timeoutMs) : result.value;
    streamToPipe = coalesceStream(streamToPipe, coalesceBytes);
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      await pipeChunks({ stream: streamToPipe, sink, signal, onChunk, stats, maxOutputSize });
      // WHY: always finalize the sink, even on abort — Express res.end() is idempotent on a closed socket, but NOT calling it leaves the response un-finalized (the framework cannot know we are done). The previous `if (!signal?.aborted)` guard caused a client mid-stream disconnect to leak an open response.
      sink.end();
    } catch (streamErr: unknown) {
      if (signal?.aborted) {
        sink.end();
      } else {
        errorCount += 1;
        emitErrorLog({
          error: toErrorLike(streamErr),
          phase: 'mid-stream',
          logError,
          dev,
          onError,
        });
        sink.write(renderMidStreamError({ err: streamErr, contentType, ide, version, dev }));
        sink.end();
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    sink.onClose?.();
    onComplete?.({ ...stats, errors: errorCount });
  }
};

export type { PipeRenderStreamOptions, PipeSink };
export { pipeRenderStream };
