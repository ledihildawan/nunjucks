import { describe, test, expect } from 'bun:test';
import { compileFor, emitLoopBindings } from './for.js';
import { ArrayNode } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  let lastId = 0;
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    _tmpid: () => { lastId++; return 't_' + lastId; },
    _compileExpression: (node) => emitted.push(node.mock),
    compile: (node) => emitted.push(node.mock),
    _withScopedSyntax: (func) => func(),
  };
};

const makeFrame = () => ({
  push: () => makeFrame(),
  pop: () => {},
  set: () => {},
});

describe('emitLoopBindings', () => {
  test('emits loop bindings for index, index0, revindex, revindex0, first, last, length', () => {
    const ctx = makeCtx();
    emitLoopBindings(ctx, 'arr', 'i', 'len');
    const code = ctx.emitted.join('');
    expect(code).toContain('frame.set("loop.index", i + 1)');
    expect(code).toContain('frame.set("loop.index0", i)');
    expect(code).toContain('frame.set("loop.revindex", len - i)');
    expect(code).toContain('frame.set("loop.revindex0", len - i - 1)');
    expect(code).toContain('frame.set("loop.first", i === 0)');
    expect(code).toContain('frame.set("loop.last", i === len - 1)');
    expect(code).toContain('frame.set("loop.length", len)');
  });
});

describe('compileFor', () => {
  test('compiles basic for loop with single variable', () => {
    const ctx = makeCtx();
    const frame = makeFrame();
    const node = {
      name: { value: 'item' },
      arr: { mock: 'arr' },
      body: { mock: 'body' },
    };
    compileFor(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('frame = frame.push()');
    expect(code).toContain('runtime.fromIterator(');
    expect(code).toContain('.length;');
    expect(code).toContain('frame.set("item"');
    expect(code).toContain('frame.set("loop.');
    expect(code).toContain('frame = frame.pop()');
  });

  test('compiles for loop with else block', () => {
    const ctx = makeCtx();
    const frame = makeFrame();
    const node = {
      name: { value: 'x' },
      arr: { mock: 'arr' },
      body: { mock: 'body' },
      else_: { mock: 'elseBody' },
    };
    compileFor(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('if (!');
    expect(code).toContain(') {');
  });

  test('compiles for loop with two-element array name (key, value) for object iteration', () => {
    const ctx = makeCtx();
    const nameNode = new ArrayNode(1, 1, [{ value: 'k' }, { value: 'v' }]);
    const frame = makeFrame();
    const node = {
      name: nameNode,
      arr: { mock: 'obj' },
      body: { mock: 'body' },
    };
    compileFor(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.isArray(');
    expect(code).toContain('runtime.keys(');
    expect(code).toContain('frame.set("k"');
    expect(code).toContain('frame.set("v"');
  });

  test('handles falsy array with guard', () => {
    const ctx = makeCtx();
    const frame = makeFrame();
    const node = {
      name: { value: 'item' },
      arr: { mock: 'nullable' },
      body: { mock: 'body' },
    };
    compileFor(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('if(');
    expect(code).toContain(') {');
  });
});
