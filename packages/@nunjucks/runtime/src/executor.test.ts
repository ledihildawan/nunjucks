import { describe, expect, test } from 'bun:test';
import { collectString } from '@nunjucks/lib/collect-stream';
import { execute, executeStream } from './executor.ts';
import { createFrame } from './frame.ts';

// WHY: fixtures mirror the Option B compiled format — root is an async generator that yields output chunks; execute drains it via collectString.
const compileBody = (body: string): string =>
  `async function* root(env, context, frame, runtime) {\n${body}\n}\nreturn { __blockMeta: {}, root: root };`;

const outputVariable = (name: string): string =>
  compileBody(
    `yield runtime.suppressValue(runtime.contextOrFrameLookup(context, frame, ${JSON.stringify(name)}), { autoescape: env.opts.autoescape, lineno: 0, colno: 0 });`
  );

const emptyFrame = () => createFrame();

describe('execute', () => {
  describe('basic execution', () => {
    test('renders compiled code and returns the output string', async () => {
      const code = compileBody('yield "hello world";');
      const result = await execute({
        code,
        context: {},
        frame: emptyFrame(),
        env: null,
        config: {},
      });
      expect(result).toBe('hello world');
    });

    test('returns a string built from a buffered output', async () => {
      const code = compileBody('yield "foo";\nyield "bar";');
      const result = await execute({
        code,
        context: {},
        frame: emptyFrame(),
        env: null,
        config: {},
      });
      expect(result).toBe('foobar');
    });

    test('preserves and renders variables from the context', async () => {
      const code = outputVariable('name');
      const result = await execute({
        code,
        context: { name: 'Alice' },
        frame: emptyFrame(),
        env: null,
        config: { autoescape: false },
      });
      expect(result).toBe('Alice');
    });
  });

  describe('autoescape', () => {
    test('defaults to true and escapes HTML', async () => {
      const code = outputVariable('html');
      const result = await execute({
        code,
        context: { html: '<b>Alice</b>' },
        frame: emptyFrame(),
        env: null,
        config: {},
      });
      expect(result).toBe('&lt;b&gt;Alice&lt;/b&gt;');
    });

    test('when false, renders raw HTML', async () => {
      const code = outputVariable('html');
      const result = await execute({
        code,
        context: { html: '<b>Alice</b>' },
        frame: emptyFrame(),
        env: null,
        config: { autoescape: false },
      });
      expect(result).toBe('<b>Alice</b>');
    });
  });

  describe('modes', () => {
    test('sandbox = true still renders output', async () => {
      const code = compileBody('yield "sandboxed";');
      const result = await execute({
        code,
        context: {},
        frame: emptyFrame(),
        env: null,
        config: { sandbox: true },
      });
      expect(result).toBe('sandboxed');
    });

    test('sandbox = true still reads context variables', async () => {
      const code = outputVariable('name');
      const result = await execute({
        code,
        context: { name: 'Bob' },
        frame: emptyFrame(),
        env: null,
        config: { sandbox: true, autoescape: false },
      });
      expect(result).toBe('Bob');
    });

    test('dev = true still renders output', async () => {
      const code = compileBody('yield "dev mode";');
      const result = await execute({
        code,
        context: {},
        frame: emptyFrame(),
        env: null,
        config: { dev: true },
      });
      expect(result).toBe('dev mode');
    });
  });

  describe('error handling', () => {
    test('rejects when code does not start with "async function* root"', async () => {
      await expect(
        execute({
          code: 'this is not valid code',
          context: {},
          frame: emptyFrame(),
          env: null,
          config: {},
        })
      ).rejects.toThrow();
    });

    test('rejects when the root function is missing', async () => {
      await expect(
        execute({
          code: 'function notRoot() {}',
          context: {},
          frame: emptyFrame(),
          env: null,
          config: {},
        })
      ).rejects.toThrow();
    });
  });
});

describe('executeStream', () => {
  test('streams compiled code without an explicit env', async () => {
    const code = compileBody('yield "chunk1";\nyield "chunk2";');
    const stream = executeStream({ code, context: {}, frame: emptyFrame(), env: null, config: {} });
    expect(await collectString(stream)).toBe('chunk1chunk2');
  });

  test('streams with a resolved default env reading context variables', async () => {
    const code = outputVariable('name');
    const stream = executeStream({
      code,
      context: { name: 'Alice' },
      frame: emptyFrame(),
      env: null,
      config: { autoescape: false },
    });
    expect(await collectString(stream)).toBe('Alice');
  });

  test('streams chunks incrementally before completion', async () => {
    const code = compileBody('yield "a";\nyield "b";\nyield "c";');
    const stream = executeStream({ code, context: {}, frame: emptyFrame(), env: null, config: {} });
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['a', 'b', 'c']);
  });

  test('honors an explicitly provided env', async () => {
    const code = outputVariable('html');
    const env = {
      opts: { dev: false, autoescape: false, undefined: 'default' as const },
      getFilter: () => null,
      getTest: () => null,
    };
    const stream = executeStream({
      code,
      context: { html: '<b>raw</b>' },
      frame: emptyFrame(),
      env,
      config: {},
    });
    expect(await collectString(stream)).toBe('<b>raw</b>');
  });
});
