// WHY: coalesces small chunks into larger writes to reduce HTTP overhead. Progressive rendering is preserved — the first chunk flushes immediately (content visible ASAP), subsequent chunks batch until threshold. 0 = no coalescing (every chunk writes immediately, maximum progressiveness). Cleanup-transparent: the for-await-of loop calls .return() on its source iterator on early termination (abort/timeout/break), so this wrapper forwards cleanup down the chain without needing its own try/finally.
/**
 * Coalesces small chunks into larger writes to reduce HTTP overhead.
 * @param stream - The async string generator to coalesce.
 * @param threshold - Minimum buffer size before flushing (0 = no coalescing).
 * @yields Progressively larger chunks of the input stream.
 */
export const coalesceStream = async function* (
  stream: AsyncGenerator<string>,
  threshold = 0
): AsyncGenerator<string> {
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
