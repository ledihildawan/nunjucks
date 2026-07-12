import { describe, test, expect } from 'bun:test';
import { compileFunCall } from './fun-call.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    _compileExpression: (node) => emitted.push(node.mock),
    compile: (node) => emitted.push(node.mock),
  };
};

describe('compileFunCall', () => {
  test('emits callWrap with lineno, colno, name, args', () => {
    const ctx = makeCtx();
    const AstSymbol = Symbol('Symbol');
    const node = {
      lineno: 3,
      colno: 7,
      name: { [AstSymbol]: true, value: 'myFunc', mock: 'myFunc' },
      args: { children: [{ mock: 'arg1' }, { mock: 'arg2' }] },
    };
    compileFunCall(ctx, node);
    expect(ctx.emitted).toEqual([
      '(lineno = 3, colno = 7, ',
      'runtime.callWrap(',
      'myFunc',
      ', "myFunc", "myFunc()", context, ',
      '[', 'arg1', ',', 'arg2', '], 3, 7))',
    ]);
  });
});
