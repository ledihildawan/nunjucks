import { describe, test, expect } from 'bun:test';
import { compileTemplateData, compileCapture, compileOutput } from './output.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    buffer: 'output',
    undefinedMode: 'chainable',
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    _emitLineWithLineno: (s, line, col) => emitted.push(s + '\n'),
    compile: (node) => emitted.push(node.mock),
    _withScopedSyntax: (func) => func(),
  };
};

describe('compileTemplateData', () => {
  test('emits buffer append with stringified value', () => {
    const ctx = makeCtx();
    compileTemplateData(ctx, { value: 'hello' });
    expect(ctx.emitted).toEqual(['output += ', '"hello"', ';']);
  });
});

describe('compileCapture', () => {
  test('wraps body in async IIFE with output buffer', () => {
    const ctx = makeCtx();
    const node = { body: { mock: 'body' } };
    compileCapture(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('(async function() {');
    expect(code).toContain('var output = "";');
    expect(code).toContain('return output;');
    expect(code).toContain('})()');
  });
});

describe('compileOutput', () => {
  test('emits TemplateData as string literal', () => {
    const ctx = makeCtx();
    const node = {
      children: [{ typename: 'TemplateData', value: 'text' }],
    };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('output += "text";');
  });

  test('emits Symbol with suppressValue and awaitValue', () => {
    const ctx = makeCtx();
    const node = {
      children: [{ typename: 'Symbol', value: 'x', lineno: 1, colno: 1, mock: 'x' }],
    };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.suppressValue(');
    expect(code).toContain('runtime.awaitValue(');
    expect(code).toContain('env.opts.autoescape');
  });

  test('wraps with ensureDefined when undefinedMode is strict', () => {
    const ctx = makeCtx();
    ctx.undefinedMode = 'strict';
    const node = {
      children: [{ typename: 'Symbol', value: 'x', lineno: 2, colno: 3, mock: 'x' }],
    };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.ensureDefined(');
    expect(code).toContain('"strict"');
  });

  test('handles Pipe without awaitValue wrapper', () => {
    const ctx = makeCtx();
    const node = {
      children: [{ typename: 'Pipe', lineno: 1, colno: 1, mock: 'piped' }],
    };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.suppressValue(');
    expect(code).not.toContain('runtime.awaitValue');
  });

  test('skips empty TemplateData', () => {
    const ctx = makeCtx();
    const node = {
      children: [{ typename: 'TemplateData', value: '' }, { typename: 'Symbol', value: 'x', lineno: 1, colno: 1, mock: 'x' }],
    };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).not.toContain('output += ""');
  });
});
