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
      name: nodes.symbol(3, 2, 'myFunc'),
      args: nodes.nodeList(3, 7, [
        nodes.symbol(3, 7, 'arg1'),
        nodes.symbol(3, 7, 'arg2'),
      ]),
    };
    compileFunCall(ctx, node);
    expect(ctx.emitted).toContain('runtime.callWrap(');
    const fullOutput = ctx.emitted.join('');
    expect(fullOutput).toContain('lineno = 3, colno = 2');
    expect(fullOutput).toContain('], 3, 2))');
    expect(fullOutput).toContain('myFunc');
  });

  test('uses lookup property location for dotted callees', () => {
    const ctx = makeCtx();
    const callee = nodes.lookupVal(
      3,
      10,
      nodes.symbol(3, 10, 'container'),
      nodes.literal(3, 20, 'get')
    );
    const node = {
      lineno: 3,
      colno: 23,
      name: callee,
      args: nodes.nodeList(3, 24, []),
    };

    compileFunCall(ctx, node);
    const fullOutput = ctx.emitted.join('');

    expect(fullOutput).toContain('lineno = 3, colno = 20');
    expect(fullOutput).toContain('], 3, 20))');
    expect(fullOutput).toContain('container.get');
  });
});
