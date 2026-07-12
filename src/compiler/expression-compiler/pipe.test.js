import { describe, test, expect } from 'bun:test';
import { compilePipe, compilePipeAsync } from './pipe.js';
import { AstSymbol, getNodeTypeName } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(`LINE:${s}`),
    compile: (node) => emitted.push(node.mock),
    assertType: (node, ...types) => {
      if (!types.some(t => node instanceof t)) {
        throw new Error(`assertType failed: ${getNodeTypeName(node)}`);
      }
    },
  };
};

describe('compilePipe', () => {
  test('emits filter call with context and args', () => {
    const ctx = makeCtx();
    const node = {
      name: AstSymbol(1, 1, 'upper'),
      args: { children: [{ mock: 'arg1' }] },
    };
    compilePipe(ctx, node);
    expect(ctx.emitted).toEqual([
      'await runtime.awaitValue(env.getFilter("upper").call(context, ',
      'arg1',
      '))',
    ]);
  });
});

describe('compilePipeAsync', () => {
  test('emits async filter assignment', () => {
    const ctx = makeCtx();
    const frame = { set: () => {} };
    const node = {
      lineno: 5,
      colno: 2,
      name: AstSymbol(1, 1, 'myFilter'),
      symbol: { value: 't_1' },
      args: { children: [{ mock: 'arg1' }] },
    };
    compilePipeAsync(ctx, node, frame);
    expect(ctx.emitted).toEqual([
      'LINE:lineno = 5; colno = 2;',
      't_1 = await runtime.awaitValue(env.getFilter("myFilter").call(context, ',
      'arg1',
      'LINE:));',
    ]);
  });
});
