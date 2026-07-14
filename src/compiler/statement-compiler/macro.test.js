import { describe, test, expect } from 'bun:test';
import { compileMacroPublic, compileCaller } from './macro.js';
import { nodes } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  let lastId = 0;
  const bufStack = [];
  let buf = 'output';
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    _emitLines: (...lines) => lines.forEach(l => emitted.push(l + '\n')),
    _tmpid: () => { lastId++; return 't_' + lastId; },
    _compileExpression: (node) => emitted.push(node.mock),
    compile: (node) => emitted.push(node.mock),
    _withScopedSyntax: (func) => func(),
    _pushBuffer: () => {
      bufStack.push(buf);
      buf = 't_' + (++lastId);
      emitted.push('let ' + buf + ' = ""\n');
      return buf;
    },
    _popBuffer: () => { buf = bufStack.pop(); },
    get buffer() { return buf; },
    set buffer(v) { buf = v; },
    assertType: (node, ...types) => {
      if (!types.some(t => nodes.getNodeTypeName(node) === t)) {
        throw new Error(`assertType: invalid type: ${nodes.getNodeTypeName(node)}`);
      }
    },
  };
};

describe('compileMacroPublic', () => {
  test('compiles macro with positional args', () => {
    const ctx = makeCtx();
    const name = nodes.symbol(1, 1, 'myMacro');
    const arg1 = nodes.symbol(1, 1, 'a');
    const arg2 = nodes.symbol(1, 1, 'b');
    const node = {
      name,
      args: { type: 'nodeList', children: [arg1, arg2] },
      body: { mock: 'body' },
    };
    const frame = { parent: null, set: () => {} };
    compileMacroPublic(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.makeMacro(');
    expect(code).toContain('"a", "b"');
    expect(code).toContain('async (l_a, l_b, kwargs) =>');
    expect(code).toContain('macro_t_1');
    expect(code).toContain('runtime.createSafeString');
    expect(code).toContain('context.setVariable("myMacro"');
  });

  test('compiles macro with kwargs', () => {
    const ctx = makeCtx();
    const name = nodes.symbol(1, 1, 'myMacro');
    const arg1 = nodes.symbol(1, 1, 'a');
    const kwarg = nodes.dict(1, 1, [nodes.pair(1, 1, nodes.symbol(1, 1, 'opt'), nodes.symbol(1, 1, 'default'))]);
    const node = {
      name,
      args: { type: 'nodeList', children: [arg1, kwarg] },
      body: { mock: 'body' },
    };
    const frame = { parent: null, set: () => {} };
    compileMacroPublic(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('"opt"');
    expect(code).toContain('Object.prototype.hasOwnProperty.call(kwargs, "opt")');
    expect(code).toContain('context.addExport("myMacro"');
  });

  test('compiles macro with frame parent', () => {
    const ctx = makeCtx();
    const name = nodes.symbol(1, 1, 'myMacro');
    const node = {
      name,
      args: { children: [] },
      body: { mock: 'body' },
    };
    const calls = [];
    const frame = { parent: {}, set: (k, v) => { calls.push([k, v]); } };
    compileMacroPublic(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('frame.set("myMacro"');
    expect(code).not.toContain('context.addExport');
  });

  test('asserts arg types', () => {
    const ctx = makeCtx();
    const node = {
      name: nodes.symbol(1, 1, 'bad'),
      args: { children: ['not a symbol'] },
      body: { mock: 'body' },
    };
    const frame = { parent: null, set: () => {} };
    expect(() => compileMacroPublic(ctx, node, frame)).toThrow('assertType');
  });
});

describe('compileCaller', () => {
  test('wraps macro in IIFE', () => {
    const ctx = makeCtx();
    const name = nodes.symbol(1, 1, 'callerFn');
    const node = {
      name,
      args: { children: [] },
      body: { mock: 'body' },
    };
    const frame = { push: () => ({ set: () => {} }) };
    compileCaller(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('(function (){');
    expect(code).toContain('return macro_t_1;})()');
  });
});
