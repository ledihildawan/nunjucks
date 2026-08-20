import { describe, expect, test } from 'bun:test';
import { toWebReadableStream } from './web-readable-stream.ts';

const sourceOf = async function* (chunks: readonly string[]): AsyncGenerator<string> {
  yield* chunks;
};

describe('toWebReadableStream', () => {
  test('emits one encoded Uint8Array chunk per source chunk and closes', async () => {
    const reader = toWebReadableStream(sourceOf(['héllo'])).getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(first.value).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(first.value ?? new Uint8Array())).toBe('héllo');
    expect((await reader.read()).done).toBe(true);
  });

  test('preserves chunk order and full content fidelity', async () => {
    const reader = toWebReadableStream(sourceOf(['Hello', ' ', 'World'])).getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const step = await reader.read();
      if (step.done) {
        break;
      }
      text += decoder.decode(step.value);
    }
    expect(text).toBe('Hello World');
  });

  test('closes immediately for an empty source', async () => {
    const reader = toWebReadableStream(sourceOf([])).getReader();
    expect((await reader.read()).done).toBe(true);
  });
});
