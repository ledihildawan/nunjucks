import { describe, test, expect } from 'bun:test';
import { compileTemplateData, compileCapture, compileOutput } from './output.js';
import { nodes } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    buffer: 'output',
    undefinedMode: 'chainable',
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    _emitLineWithLineno: (s, line, col) => emitted.push(`${s}\n`),
    compile: (node) => emitted.push(node.mock || JSON.stringify(node.value)),
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
    expect(code).toContain('(async () => {');
    expect(code).toContain('let output = "";');
    expect(code).toContain('return output;');
    expect(code).toContain('})()');
  });
});

describe('compileOutput', () => {
  test('emits TemplateData as string literal', () => {
    const ctx = makeCtx();
    const node = {
      children: [nodes.templateData(0, 0, 'text')],
    };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('output += "text";');
  });

  test('emits Symbol with suppressValue and awaitValue', () => {
    const ctx = makeCtx();
    const node = {
      children: [nodes.symbol(1, 1, 'x')],
    };
    node.children[0].mock = 'x';
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
      children: [nodes.symbol(2, 3, 'x')],
    };
    node.children[0].mock = 'x';
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.ensureDefined(');
    expect(code).toContain('"strict"');
  });

  test('handles Pipe without awaitValue wrapper', () => {
    const ctx = makeCtx();
    const pipeNode = nodes.pipe(1, 1);
    pipeNode.mock = 'piped';
    const node = { children: [pipeNode] };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.suppressValue(');
    expect(code).not.toContain('runtime.awaitValue');
  });

  test('skips empty TemplateData', () => {
    const ctx = makeCtx();
    const td = nodes.templateData(0, 0, '');
    td.mock = '';
    const sym = nodes.symbol(1, 1, 'x');
    sym.mock = 'x';
    const node = { children: [td, sym] };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).not.toContain('output += ""');
  });

  test('emits debug mode for LookupVal in debug mode (shows warning)', () => {
    const ctx = makeCtx();
    ctx.undefinedMode = 'debug';
    const target = nodes.symbol(0, 0, 'user');
    target.mock = 'user';
    const val = { value: 'name' };
    const lookupVal = nodes.lookupVal(1, 5, target, val);
    lookupVal.mock = 'memberLookup';
    const node = { children: [lookupVal] };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.ensureDefined(');
    expect(code).toContain('"debug"');
    expect(code).toContain('user.name');
  });

  test('emits strict mode for LookupVal in strict mode (throws error)', () => {
    const ctx = makeCtx();
    ctx.undefinedMode = 'strict';
    const target = nodes.symbol(0, 0, 'user');
    target.mock = 'user';
    const val = { value: 'name' };
    const lookupVal = nodes.lookupVal(1, 5, target, val);
    lookupVal.mock = 'memberLookup';
    const node = { children: [lookupVal] };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.ensureDefined(');
    expect(code).toContain('"strict"');
    expect(code).toContain('user.name');
  });

  test('emits debug mode for Symbol in debug mode (shows warning)', () => {
    const ctx = makeCtx();
    ctx.undefinedMode = 'debug';
    const sym = nodes.symbol(1, 1, 'user');
    sym.mock = 'user';
    const node = { children: [sym] };
    compileOutput(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.ensureDefined(');
    expect(code).toContain('"debug"');
    expect(code).toContain('user');
  });
});
