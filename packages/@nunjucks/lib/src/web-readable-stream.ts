// WHY: Web ReadableStream is the universal primitive — Node (>=18 via Readable.fromWeb), Bun, Deno, and edge runtimes all consume it, so a single adapter covers every target without a node: import in core.

const encodeChunk = (chunk: string): Uint8Array => new TextEncoder().encode(chunk);

/**
 * Adapts a string-producing async iterable into a WHATWG `ReadableStream` of
 * UTF-8 bytes, pulling one chunk per backpressure tick. `cancel` forwards to
 * the source iterator's `return` so consumers can terminate the chain early.
 */
export const toWebReadableStream = (stream: AsyncIterable<string>): ReadableStream<Uint8Array> => {
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
    },
  });
};
