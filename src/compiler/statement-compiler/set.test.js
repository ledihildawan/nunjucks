import { describe, test, expect } from 'bun:test';
import { compileSet } from './set.js';

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
  };
};

const makeFrame = (vars) => ({
  lookup: (name) => vars?.[name] ?? null,
  topLevel: true,
});

describe('compileSet', () => {
  test('compiles set with value expression using = operator', () => {
    const ctx = makeCtx();
    const node = {
      targets: [{ value: 'x' }],
      value: { mock: '42' },
      operator: '=',
    };
    const frame = makeFrame();
    compileSet(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('t_1 = 42');
    expect(code).toContain('frame.set("x", t_1, true)');
    expect(code).toContain('context.setVariable("x", t_1)');
    expect(code).toContain('context.addExport("x", t_1)');
  });

  test('compiles set with compound operator ||=', () => {
    const ctx = makeCtx();
    const node = {
      targets: [{ value: 'y' }],
      value: { mock: 'val' },
      operator: '||=',
    };
    const frame = makeFrame({ y: 'old' });
    compileSet(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('old ||= val');
  });

  test('compiles set with block body (capture)', () => {
    const ctx = makeCtx();
    const node = {
      targets: [{ value: 'z' }],
      body: { mock: 'capturedBody' },
    };
    const frame = makeFrame();
    compileSet(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('await capturedBody');
  });

  test('compiles set with multiple targets', () => {
    const ctx = makeCtx();
    const node = {
      targets: [{ value: 'a' }, { value: 'b' }],
      value: { mock: 'arr' },
      operator: '=',
    };
    const frame = makeFrame();
    compileSet(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).toContain('t_1 = t_2 = arr');
    expect(code).toContain('frame.set("a", t_1, true)');
    expect(code).toContain('frame.set("b", t_2, true)');
  });

  test('skips addExport for underscore-prefixed names', () => {
    const ctx = makeCtx();
    const node = {
      targets: [{ value: '_private' }],
      value: { mock: 'val' },
      operator: '=',
    };
    const frame = makeFrame();
    compileSet(ctx, node, frame);
    const code = ctx.emitted.join('');
    expect(code).not.toContain('context.addExport');
  });
});
