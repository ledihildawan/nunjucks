// WHY: Web ReadableStream is the universal primitive — Node (>=18 via Readable.fromWeb), Bun, Deno, and edge runtimes all consume it, so a single adapter covers every target without a node: import in core.

const encodeChunk = (chunk: string): Uint8Array => new TextEncoder().encode(chunk);

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
