import { describe, expect, test } from 'bun:test';
import { isOk } from '@nunjucks/lib';
import { collectString } from '@nunjucks/lib/collect-stream';
import { render, renderToStream } from './render.ts';

describe('renderToStream', () => {
  test('drained stream output matches blocking render', async () => {
    const template = 'Hello {{ name }}!';
    const options = { context: { name: 'World' } };
    const blocking = await render(template, options);
    const streamed = await renderToStream(template, options);

    expect(streamed.ok).toBe(true);
    if (!streamed.ok) {
      return;
    }
    const expected = isOk(blocking) ? blocking.value : '';
    expect(await collectString(streamed.value)).toBe(expected);
  });

  test('pre-stream error returns { ok: false, error } before any chunk is produced', async () => {
    const result = await renderToStream('{{ unclosed', {});

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toBeDefined();
    expect(result.error.name).toBe('Template render error');
  });

  test('mid-stream runtime error throws after partial output is yielded', async () => {
    const result = await renderToStream('OK {{ bad.missing }}', {
      context: { bad: {} },
      undefined: 'strict',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const chunks: string[] = [];
    const iterate = async (): Promise<void> => {
      for await (const chunk of result.value) {
        chunks.push(chunk);
      }
    };
    await expect(iterate()).rejects.toThrow();
    // WHY: the literal "OK " is yielded before the failing expression, proving chunks flushed incrementally before the mid-stream throw.
    expect(chunks.join('')).toBe('OK ');
  });

  test('stream yields multiple incremental chunks, not a single buffered string', async () => {
    const result = await renderToStream('a{{ b }}c', { context: { b: 'B' } });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const chunks: string[] = [];
    for await (const chunk of result.value) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe('aBc');
  });

  test('for-loop streamed output matches blocking render', async () => {
    const template = '{% for item in items %}{{ item }},{% endfor %}';
    const options = { context: { items: ['a', 'b', 'c'] } };
    const blocking = await render(template, options);
    const streamed = await renderToStream(template, options);

    expect(streamed.ok).toBe(true);
    if (!streamed.ok) {
      return;
    }
    expect(await collectString(streamed.value)).toBe(isOk(blocking) ? blocking.value : '');
  });

  test('async filter runs during streaming — output correct and delay respected', async () => {
    const slow = async (value: unknown): Promise<string> => {
      await new Promise((resolve) => {
        setTimeout(resolve, 120);
      });
      return String(value);
    };
    const template = '[{{ a |> slow }}][{{ b |> slow }}]';
    const start = Date.now();
    const result = await renderToStream(template, {
      context: { a: '1', b: '2' },
      filters: { slow },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const output = await collectString(result.value);
    expect(output).toBe('[1][2]');
    // WHY: two sequential ~120ms awaits must elapse, proving the async filter executed inline during the stream (a fully synchronous/buffered path could not block on them).
    expect(Date.now() - start).toBeGreaterThanOrEqual(220);
  });

  test('fatal-code error mid-stream terminates the stream even with streamErrorRecovery enabled', async () => {
    // WHY: a custom filter throws an error carrying a fatal code + lineno. handleError re-throws the original
    // (preserving .code), streamError detects the fatal code and re-throws instead of yielding an inline marker.
    // The generator throws — " after" must never stream, proving the fatal denylist aborts the page.
    const fatalBoom = (_value: unknown): never => {
      throw Object.assign(new Error('timed out'), { code: 'TIMEOUT', lineno: 1 });
    };
    const result = await renderToStream('before {{ value |> fatalBoom }} after', {
      context: { value: 'x' },
      streamErrorRecovery: true,
      filters: { fatalBoom },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const chunks: string[] = [];
    const iterate = async (): Promise<void> => {
      for await (const chunk of result.value) {
        chunks.push(chunk);
      }
    };
    await expect(iterate()).rejects.toThrow();
    expect(chunks.join('')).toBe('before ');
    expect(chunks.join('')).not.toContain('after');
  });

  test('recoverable error mid-stream yields an inline marker and continues when streamErrorRecovery is enabled', async () => {
    // WHY: contrast case — a non-fatal code (NULL_VALUE) becomes an inline sentinel marker; the rest of the
    // page renders, proving only FATAL_STREAM_CODES abort while ordinary data errors stay inline.
    const softBoom = (_value: unknown): never => {
      throw Object.assign(new Error('null value'), { code: 'NULL_VALUE', lineno: 1 });
    };
    const result = await renderToStream('before {{ value |> softBoom }} after', {
      context: { value: 'x' },
      streamErrorRecovery: true,
      filters: { softBoom },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const output = await collectString(result.value);
    expect(output).toContain('before');
    expect(output).toContain('after');
  });

  test('stream is single-use — a second iteration rejects with a clear error', async () => {
    const result = await renderToStream('Hello {{ name }}!', { context: { name: 'World' } });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    await collectString(result.value);
    const iterateAgain = async (): Promise<void> => {
      for await (const _chunk of result.value) {
        void _chunk;
      }
    };
    await expect(iterateAgain()).rejects.toThrow('already consumed');
    // WHY: the catalog code lets consumers branch on API misuse without message matching
    await expect(iterateAgain()).rejects.toMatchObject({ code: 'STREAM_ALREADY_CONSUMED' });
  });

  test('streamContentType json makes a recoverable sentinel fatal instead of an inline marker', async () => {
    // WHY: a NULL_VALUE error that would normally inline-marker becomes a throw under json, because a bare
    // error fragment would corrupt the JSON response. The stream aborts after the pre-error prefix.
    const softBoom = (_value: unknown): never => {
      throw Object.assign(new Error('null value'), { code: 'NULL_VALUE', lineno: 1 });
    };
    const result = await renderToStream('before {{ value |> softBoom }} after', {
      context: { value: 'x' },
      streamErrorRecovery: true,
      streamContentType: 'json',
      filters: { softBoom },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const chunks: string[] = [];
    const iterate = async (): Promise<void> => {
      for await (const chunk of result.value) {
        chunks.push(chunk);
      }
    };
    await expect(iterate()).rejects.toThrow();
    expect(chunks.join('')).toBe('before ');
  });

  test('executionTimeout acts as a total wall-clock deadline for the streaming render', async () => {
    // WHY: two ~60ms sequential slow filters (120ms total) must be aborted by an 80ms total deadline. The idle
    // guard would not catch this (each chunk arrives in time); only the total deadline bounds it.
    const slow = async (value: unknown): Promise<string> => {
      await new Promise((resolve) => {
        setTimeout(resolve, 60);
      });
      return String(value);
    };
    const result = await renderToStream('[{{ a |> slow }}][{{ b |> slow }}]', {
      context: { a: '1', b: '2' },
      filters: { slow },
      executionTimeout: 80,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const iterate = async (): Promise<void> => {
      for await (const _chunk of result.value) {
        void _chunk;
      }
    };
    await expect(iterate()).rejects.toThrow();
  });

  test('streaming coerces SafeString filter output to primitive string (res.write compatibility)', async () => {
    // WHY: regression for ERR_INVALID_ARG_TYPE — tojson returns a SafeString (a boxed String, instanceof String).
    // The streaming yield path must coerce it to a primitive string so HTTP sinks (Express res.write /
    // TextEncoder.encode) accept the chunk. The blocking path hid this because `buffer += safeString` coerces
    // via toString; streaming yields the object directly.
    const result = await renderToStream('{{ obj |> tojson }}', { context: { obj: { a: 1 } } });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const chunks: string[] = [];
    for await (const chunk of result.value) {
      expect(typeof chunk).toBe('string');
      chunks.push(chunk);
    }
    expect(chunks.join('')).toBe('{"a":1}');
  });
});
