import { describe, test, expect } from 'bun:test';
import { compileAsyncEach, compileAsyncAll } from './async-each.js';
import { ArrayNode } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  let lastId = 0;
  let buf = 'output';
  const bufStack = [];
  return {
    emitted,
    buffer: buf,
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(s + '\n'),
    _tmpid: () => { lastId++; return 't_' + lastId; },
    _compileExpression: (node) => emitted.push(node.mock),
    compile: (node) => emitted.push(node.mock),
    _withScopedSyntax: (func) => func(),
    _pushBuffer: () => {
      bufStack.push(buf);
      buf = 't_' + (++lastId);
      emitted.push('var ' + buf + ' = "";\n');
      return buf;
    },
    _popBuffer: () => { buf = bufStack.pop(); },
    get buffer() { return buf; },
    set buffer(v) { buf = v; },
  };
};

describe('compileAsyncEach', () => {
  test('compiles asyncEach with simple name', () => {
    const ctx = makeCtx();
    const node = {
      name: { value: 'item' },
      arr: { mock: 'arr' },
      body: { mock: 'body' },
    };
    const frame = { push: () => ({ set: () => {} }), pop: () => {}, set: () => {} };

    compileAsyncEach(ctx, node, frame);

    const code = ctx.emitted.join('');
    expect(code).toContain('frame = frame.push()');
    expect(code).toContain('runtime.fromIterator(');
    expect(code).toContain('frame.set("loop.');
    expect(code).toContain('frame = frame.pop()');
  });

  test('compiles asyncEach with else block', () => {
    const ctx = makeCtx();
    const node = {
      name: { value: 'x' },
      arr: { mock: 'arr' },
      body: { mock: 'body' },
      else_: { mock: 'elseBody' },
    };
    const frame = { push: () => ({ set: () => {} }), pop: () => {}, set: () => {} };

    compileAsyncEach(ctx, node, frame);

    const code = ctx.emitted.join('');
    expect(code).toContain('if (!');
    expect(code).toContain('.length) {');
  });
});

describe('compileAsyncAll', () => {
  test('compiles asyncAll with simple name', () => {
    const ctx = makeCtx();
    const node = {
      name: { value: 'item' },
      arr: { mock: 'arr' },
      body: { mock: 'body' },
    };
    const frame = { push: () => ({ set: () => {} }), pop: () => {}, set: () => {} };

    compileAsyncAll(ctx, node, frame);

    const code = ctx.emitted.join('');
    expect(code).toContain('frame = frame.push()');
    expect(code).toContain('runtime.fromIterator(');
    expect(code).toContain('.push(t_');
    expect(code).toContain('frame = frame.pop()');
  });

  test('compiles asyncAll with two-element array name (key, value)', () => {
    const ctx = makeCtx();
    const nameNode = new ArrayNode(1, 1, [{ value: 'k' }, { value: 'v' }]);
    const node = {
      name: nameNode,
      arr: { mock: 'arrObj' },
      body: { mock: 'body' },
    };
    const frame = { push: () => ({ set: () => {} }), pop: () => {}, set: () => {} };

    compileAsyncAll(ctx, node, frame);

    const code = ctx.emitted.join('');
    expect(code).toContain('runtime.isArray(');
    expect(code).toContain('runtime.keys(');
  });
});
