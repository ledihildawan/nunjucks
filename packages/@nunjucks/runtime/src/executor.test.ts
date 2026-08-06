import { describe, test, expect } from 'bun:test';
import { execute } from './executor.ts';
import { createFrame } from './frame.ts';

const compileBody = (body: string): string =>
  `async function root(env, context, frame, runtime) {\n${body}\n}\nreturn { __blockMeta: {}, root: root };`;

const outputVariable = (name: string): string =>
  compileBody([
    'let output = "";',
    `output += runtime.suppressValue(runtime.contextOrFrameLookup(context, frame, ${JSON.stringify(name)}), context._autoescape, 0, 0);`,
    'return output;',
  ].join('\n'));

const emptyFrame = () => createFrame();

describe('execute', () => {
  describe('basic execution', () => {
    test('renders compiled code and returns the output string', async () => {
      const code = compileBody('return "hello world";');
      const result = await execute(code, {}, emptyFrame(), null, {});
      expect(result).toBe('hello world');
    });

    test('returns a string built from a buffered output', async () => {
      const code = compileBody('let output = "";\noutput += "foo";\noutput += "bar";\nreturn output;');
      const result = await execute(code, {}, emptyFrame(), null, {});
      expect(result).toBe('foobar');
    });

    test('preserves and renders variables from the context', async () => {
      const code = outputVariable('name');
      const result = await execute(code, { name: 'Alice' }, emptyFrame(), null, { autoescape: false });
      expect(result).toBe('Alice');
    });
  });

  describe('autoescape', () => {
    test('defaults to true and escapes HTML', async () => {
      const code = outputVariable('html');
      const result = await execute(code, { html: '<b>Alice</b>' }, emptyFrame(), null, {});
      expect(result).toBe('&lt;b&gt;Alice&lt;/b&gt;');
    });

    test('when false, renders raw HTML', async () => {
      const code = outputVariable('html');
      const result = await execute(code, { html: '<b>Alice</b>' }, emptyFrame(), null, { autoescape: false });
      expect(result).toBe('<b>Alice</b>');
    });
  });

  describe('modes', () => {
    test('sandbox = true still renders output', async () => {
      const code = compileBody('return "sandboxed";');
      const result = await execute(code, {}, emptyFrame(), null, { sandbox: true });
      expect(result).toBe('sandboxed');
    });

    test('sandbox = true still reads context variables', async () => {
      const code = outputVariable('name');
      const result = await execute(code, { name: 'Bob' }, emptyFrame(), null, { sandbox: true, autoescape: false });
      expect(result).toBe('Bob');
    });

    test('dev = true still renders output', async () => {
      const code = compileBody('return "dev mode";');
      const result = await execute(code, {}, emptyFrame(), null, { dev: true });
      expect(result).toBe('dev mode');
    });
  });

  describe('error handling', () => {
    test('rejects when code does not start with "async function root"', async () => {
      await expect(execute('this is not valid code', {}, emptyFrame(), null, {})).rejects.toThrow();
    });

    test('rejects when the root function is missing', async () => {
      await expect(execute('function notRoot() {}', {}, emptyFrame(), null, {})).rejects.toThrow();
    });
  });
});
