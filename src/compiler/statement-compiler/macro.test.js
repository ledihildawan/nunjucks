import { describe, test, expect } from 'bun:test';
import { compileMacroPublic } from './macro.js';
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
