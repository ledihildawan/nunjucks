// WHY: consumer-side streaming helpers. renderToStream yields a plain AsyncGenerator<string>; these adapters convert it into the stream shapes real HTTP/runtimes expect, and enforce a per-chunk timeout so a stalled render cannot hang a response indefinitely.

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
  timeoutMs: number;
}

const createStreamTimeoutError = (timeoutMs: number): StreamTimeoutError => {
  const error = new Error(`Stream chunk timed out after ${timeoutMs}ms`) as StreamTimeoutError;
  error.name = 'StreamTimeoutError';
  error.isStreamTimeout = true;
  error.timeoutMs = timeoutMs;
  return error;
};

const isStreamTimeoutError = (value: unknown): value is StreamTimeoutError =>
  typeof value === 'object' && value !== null && (value as { isStreamTimeout?: unknown }).isStreamTimeout === true;

// WHY: a generator cannot be wrapped by withTimeout (it is not a Promise), so streaming timeout is enforced per-chunk: each .next() races against a timer. On timeout the underlying iterator is returned (cleaned up) and a StreamTimeoutError is thrown to the consumer. This catches stalled renders (e.g. a slow async filter that never resolves) without an overall deadline that conflicts with legitimate long streams.
const withStreamTimeout = async function* (stream: AsyncIterator<string>, timeoutMs: number): AsyncGenerator<string> {
  while (true) {
    const timeoutToken = Symbol('streamTimeout');
    const timer = new Promise((resolve) => { setTimeout(() => { resolve(timeoutToken); }, timeoutMs); });
    const raced = await Promise.race([stream.next(), timer]);
    if (raced === timeoutToken) {
      await stream.return?.();
      throw createStreamTimeoutError(timeoutMs);
    }
    const step = raced as IteratorResult<string>;
    if (step.done) {
      return;
    }
    yield step.value;
  }
};

export { toWebReadableStream, withStreamTimeout, isStreamTimeoutError, createStreamTimeoutError };
export type { StreamTimeoutError };
