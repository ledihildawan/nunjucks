// WHY: consumer-side streaming helpers. renderToStream yields a plain AsyncGenerator<string>; these adapters convert it into the stream shapes real HTTP/runtimes expect, and enforce a per-chunk timeout so a stalled render cannot hang a response indefinitely.

import { isThenable } from '@nunjucks/shared';

const encodeChunk = (chunk: string): Uint8Array => new TextEncoder().encode(chunk);

// WHY: Web ReadableStream is the universal primitive — Node (>=18 via Readable.fromWeb), Bun, Deno, and edge runtimes all consume it, so a single adapter covers every target without a node: import in core.
const toWebReadableStream = (stream: AsyncIterable<string>): ReadableStream<Uint8Array> => {
  const iterator = stream[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encodeChunk(value));
    },
    cancel() {
      iterator.return?.();
    }
  });
};

interface StreamTimeoutError extends Error {
  isStreamTimeout: true;
  code: string;
  timeoutMs: number;
  kind: 'idle' | 'deadline';
}

// WHY: carries code='TIMEOUT' so it is recognized by FATAL_STREAM_CODES (Tier 3 fatal) — the same code the blocking path's withTimeout emits — keeping streaming and blocking timeout errors shape-consistent. `kind` distinguishes idle (per-chunk) from deadline (total wall-clock) for observability without splitting the catalog code.
const createStreamTimeoutError = (timeoutMs: number, kind: 'idle' | 'deadline' = 'idle'): StreamTimeoutError => {
  const label = kind === 'deadline' ? `exceeded total deadline of ${timeoutMs}ms` : `chunk timed out after ${timeoutMs}ms`;
  const error = new Error(`Stream ${label}`) as StreamTimeoutError;
  error.name = 'StreamTimeoutError';
  error.isStreamTimeout = true;
  error.code = 'TIMEOUT';
  error.timeoutMs = timeoutMs;
  error.kind = kind;
  return error;
};

const isStreamTimeoutError = (value: unknown): value is StreamTimeoutError =>
  typeof value === 'object' && value !== null && (value as { isStreamTimeout?: unknown }).isStreamTimeout === true;

// WHY: a generator cannot be wrapped by withTimeout (it is not a Promise), so streaming timeout is enforced per-chunk: each .next() races against a timer. This is the idle/per-chunk guard complementing the total executionTimeout deadline enforced by withStreamDeadline. try/finally guarantees the timer is cleared on EVERY exit path (chunk yielded, done, timeout, external .return(), throw) — previously N chunks leaked N concurrent timers. The finally also best-effort returns the underlying iterator WITHOUT awaiting: a stalled .next() (e.g. an async filter awaiting a never-resolving promise) may never let .return() settle, so awaiting would re-introduce the hang this guard exists to break. A .return() on an already-completed iterator is a no-op, so calling it unconditionally is safe.
const withStreamTimeout = async function* (stream: AsyncIterator<string>, timeoutMs: number): AsyncGenerator<string> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  try {
    while (true) {
      const timeoutToken = Symbol('streamTimeout');
      const timerPromise = new Promise<symbol>((resolve) => {
        handle = setTimeout(() => { resolve(timeoutToken); }, timeoutMs);
      });
      const raced = await Promise.race([stream.next(), timerPromise]);
      clearTimeout(handle);
      handle = undefined;
      if (raced === timeoutToken) {
        throw createStreamTimeoutError(timeoutMs);
      }
      const step = raced as IteratorResult<string>;
      if (step.done) {
        return;
      }
      yield step.value;
    }
  } finally {
    if (handle !== undefined) { clearTimeout(handle); }
    const pendingReturn = stream.return?.();
    if (pendingReturn !== undefined) {
      pendingReturn.catch(() => { /* best-effort: swallow cleanup rejection */ });
    }
  }
};

// WHY: coalesces small chunks into larger writes to reduce HTTP overhead. Progressive rendering is preserved — the first chunk flushes immediately (content visible ASAP), subsequent chunks batch until threshold. 0 = no coalescing (every chunk writes immediately, maximum progressiveness). Cleanup-transparent: the for-await-of loop calls .return() on its source iterator on early termination (abort/timeout/break), so this wrapper forwards cleanup down the chain without needing its own try/finally.
const coalesceStream = async function* (stream: AsyncGenerator<string>, threshold = 0): AsyncGenerator<string> {
  if (threshold <= 0) {
    yield* stream;
    return;
  }
  let buffer = '';
  let isFirst = true;
  for await (const chunk of stream) {
    if (isFirst) {
      yield chunk;
      isFirst = false;
      continue;
    }
    buffer += chunk;
    if (buffer.length >= threshold) {
      yield buffer;
      buffer = '';
    }
  }
  if (buffer) {
    yield buffer;
  }
};

// WHY: total wall-clock deadline for a stream — a single timer set once at start; if it elapses before the source completes, a deadline-flavored StreamTimeoutError (code='TIMEOUT') throws regardless of chunk cadence. This complements withStreamTimeout (per-chunk idle): a stream trickling a chunk every 50ms passes the idle guard but is still bounded by the total deadline. try/finally clears the timer and cascades .return() on every exit path. Wired from createRenderStream via resolvedConfig.executionTimeout so the SAME knob bounds blocking and streaming renders.
const withStreamDeadline = async function* (stream: AsyncGenerator<string>, deadlineMs: number): AsyncGenerator<string> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadlinePromise = new Promise<never>((_, reject) => {
      handle = setTimeout(() => { reject(createStreamTimeoutError(deadlineMs, 'deadline')); }, deadlineMs);
    });
    while (true) {
      const step = await Promise.race([stream.next(), deadlinePromise]);
      if (step.done) {
        return;
      }
      yield step.value;
    }
  } finally {
    if (handle !== undefined) { clearTimeout(handle); }
    stream.return(undefined).catch(() => { /* best-effort: swallow cleanup rejection */ });
  }
};

// WHY: streaming yield boundary — coerce SafeString (a boxed String, instanceof String) to a primitive string. suppressValue returns the SafeString object for already-safe values so the blocking path's `buffer += value` coerces via toString; the streaming path yields directly, so without this coercion a SafeString object reaches the HTTP sink (res.write / TextEncoder.encode) which rejects boxed strings with ERR_INVALID_ARG_TYPE. The thenable check is a fail-loud safety net: a Promise reaching here means an emit site forgot to await (every known site does — see compile-output/extension/extends); stringifying it would silently produce "[object Promise]", so throw instead to surface the bug.
const coerceChunk = (value: unknown): string => {
  if (typeof value === 'string') { return value; }
  if (isThenable(value)) {
    throw new Error('renderToStream: Promise leaked to stream boundary — an emit site is missing await');
  }
  return String(value);
};

// WHY: single-use guard around the streaming generator. Async generators already reject CONCURRENT .next() calls ("Generator is already running"), but a consumer that caches result.stream and iterates it a SECOND time after completion would silently get an empty stream (every subsequent .next() returns { done: true }). This wrapper converts that silent empty into a clear error so the mistake surfaces immediately. .return()/.throw() delegate to the inner generator so the cleanup cascade is unaffected.
const guardSingleConsumer = (inner: AsyncGenerator<string>): AsyncGenerator<string> => {
  let finished = false;
  const iterator = {
    [Symbol.asyncIterator](): AsyncGenerator<string> { return iterator as AsyncGenerator<string>; },
    next(value?: unknown): Promise<IteratorResult<string>> {
      if (finished) {
        return Promise.reject(new Error('renderToStream: stream already consumed — a stream is single-use; call renderToStream() again for a fresh stream'));
      }
      return inner.next(value).then((result) => { if (result.done) { finished = true; } return result; });
    },
    return(value?: unknown): Promise<IteratorResult<string>> { finished = true; return inner.return(value); },
    throw(e?: unknown): Promise<IteratorResult<string>> { return inner.throw(e); },
  };
  return iterator as AsyncGenerator<string>;
};

export { toWebReadableStream, withStreamTimeout, withStreamDeadline, isStreamTimeoutError, createStreamTimeoutError, coalesceStream, coerceChunk, guardSingleConsumer };
export type { StreamTimeoutError };
