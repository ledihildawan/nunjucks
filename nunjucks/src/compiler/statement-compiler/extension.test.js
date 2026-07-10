import { describe, test, expect } from 'bun:test';
import { compileCallExtension, compileCallExtensionAsync } from './extension.js';
import { NodeList } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  let lastId = 0;
  const bufStack = [];
  let buf = 'output';
  return {
    emitted,
    buffer: buf,
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    _tmpid: () => { lastId++; return 't_' + lastId; },
    _compileExpression: (node) => emitted.push(node.mock),
    compile: (node) => emitted.push(node.mock),
    _pushBuffer: () => {
      bufStack.push(buf);
      buf = 't_' + (++lastId);
      emitted.push('var ' + buf + ' = "";\n');
      return buf;
    },
    _popBuffer: () => { buf = bufStack.pop(); },
    get buffer() { return buf; },
    set buffer(v) { buf = v; },
    fail: (msg) => { throw new Error(msg); },
  };
};

describe('compileCallExtension', () => {
  test('emits synchronous extension call', () => {
    const ctx = makeCtx();
    const node = {
      extName: 'myExt',
      prop: 'myMethod',
      args: null,
      contentArgs: [],
      autoescape: true,
    };
    compileCallExtension(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('output += runtime.suppressValue(');
    expect(code).toContain('env.getExtension("myExt")["myMethod"](');
    expect(code).toContain('context');
    expect(code).toContain('true && env.opts.autoescape');
  });

  test('emits async extension call with content args', () => {
    const ctx = makeCtx();
    const node = {
      extName: 'myExt',
      prop: 'myAsync',
      args: null,
      contentArgs: [{ mock: 'content' }],
      autoescape: false,
    };
    compileCallExtension(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('var t_1 = await env.getExtension("myExt")["myAsync"](');
    expect(code).toContain('context');
    expect(code).toContain('async function()');
    expect(code).toContain('output += runtime.suppressValue(await t_1');
    expect(code).toContain('false && env.opts.autoescape');
  });

  test('emits extension call with real NodeList args', () => {
    const ctx = makeCtx();
    const args = new NodeList();
    const mockChild = { mock: 'arg1' };
    args.addChild(mockChild);
    const node = {
      extName: 'myExt',
      prop: 'myMethod',
      args,
      contentArgs: [],
      autoescape: true,
    };
    compileCallExtension(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('arg1');
  });

  test('fails when args is not a NodeList', () => {
    const ctx = makeCtx();
    const node = {
      extName: 'myExt',
      prop: 'myMethod',
      args: 'not a nodelist',
      contentArgs: [],
    };
    expect(() => compileCallExtension(ctx, node)).toThrow(
      'compileCallExtension: arguments must be a NodeList');
  });
});

describe('compileCallExtensionAsync', () => {
  test('delegates to compileCallExtension with useAsync', () => {
    const ctx = makeCtx();
    const node = {
      extName: 'myExt',
      prop: 'myAsync',
      args: null,
      contentArgs: [],
      autoescape: true,
    };
    compileCallExtensionAsync(ctx, node);
    const code = ctx.emitted.join('');
    expect(code).toContain('var t_1 = await env.getExtension');
  });
});
