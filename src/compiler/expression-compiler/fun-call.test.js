import { describe, test, expect } from 'bun:test';
import { compileFunCall } from './fun-call.js';
import { nodes } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    _compileExpression: (node) => emitted.push(node.value || node.mock || ''),
    compile: (node) => emitted.push(node.value || node.mock || ''),
  };
};

describe('compileFunCall', () => {
  test('emits callWrap with lineno, colno, name, args', () => {
    const ctx = makeCtx();
    const node = {
      lineno: 3,
      colno: 7,
      name: nodes.symbol(3, 7, 'myFunc'),
      args: nodes.nodeList(3, 7, [
        nodes.symbol(3, 7, 'arg1'),
        nodes.symbol(3, 7, 'arg2'),
      ]),
    };
    compileFunCall(ctx, node);
    expect(ctx.emitted).toContain('runtime.callWrap(');
    const fullOutput = ctx.emitted.join('');
    expect(fullOutput).toContain('myFunc');
  });
});
