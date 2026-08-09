import { describe, test, expect } from 'bun:test';
import { render, renderToStream } from './render.ts';
import { collectString } from '@nunjucks/runtime';
import { isOk } from '@nunjucks/shared';

describe('renderToStream', () => {
  test('drained stream output matches blocking render', async () => {
    const template = 'Hello {{ name }}!';
    const options = { context: { name: 'World' } };
    const blocking = await render(template, options);
    const streamed = await renderToStream(template, options);

    expect(streamed.ok).toBe(true);
    if (!streamed.ok) { return; }
    const expected = isOk(blocking) ? blocking.value : '';
    expect(await collectString(streamed.stream)).toBe(expected);
  });

  test('pre-stream error returns { ok: false, error } before any chunk is produced', async () => {
    const result = await renderToStream('{{ unclosed', {});

    expect(result.ok).toBe(false);
    if (result.ok) { return; }
    expect(result.error).toBeDefined();
    expect(result.error.name).toBe('Template render error');
  });

  test('mid-stream runtime error throws after partial output is yielded', async () => {
    const result = await renderToStream('OK {{ bad.missing }}', { context: { bad: {} }, undefined: 'strict' });

    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    const chunks: string[] = [];
    const iterate = async (): Promise<void> => {
      for await (const chunk of result.stream) { chunks.push(chunk); }
    };
    await expect(iterate()).rejects.toThrow();
    // WHY: the literal "OK " is yielded before the failing expression, proving chunks flushed incrementally before the mid-stream throw.
    expect(chunks.join('')).toBe('OK ');
  });

  test('stream yields multiple incremental chunks, not a single buffered string', async () => {
    const result = await renderToStream('a{{ b }}c', { context: { b: 'B' } });

    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    const chunks: string[] = [];
    for await (const chunk of result.stream) { chunks.push(chunk); }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe('aBc');
  });
});
