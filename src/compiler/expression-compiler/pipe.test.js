import { describe, test, expect } from 'bun:test';
import { compilePipe, compilePipeAsync } from './pipe.js';
import { nodes } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    _emitLine: (s) => emitted.push(`LINE:${s}`),
    compile: (node) => emitted.push(node.mock),
    assertType: (node, ...types) => {
      if (!types.some(t => nodes.getNodeTypeName(node) === t)) {
        throw new Error(`assertType failed: ${nodes.getNodeTypeName(node)}`);
      }
    },
  };
};

describe('compilePipe', () => {
  test('emits filter call with context and args', () => {
    const ctx = makeCtx();
    const node = {
      type: 'pipe',
      lineno: 1,
      colno: 1,
      name: nodes.symbol(1, 1, 'upper'),
      args: nodes.nodeList(1, 1, [nodes.symbol(1, 1, 'arg1')]),
    };
    compilePipe(ctx, node);
    expect(ctx.emitted).toContain('await runtime.awaitValue(env.getFilter("upper", 1, 1, 1, 1, "arg1").call(context, ');
  });
});

describe('compilePipeAsync', () => {
  test('emits async filter assignment', () => {
    const ctx = makeCtx();
    const frame = { set: () => {} };
    const node = {
      type: 'pipeAsync',
      lineno: 5,
      colno: 2,
      name: nodes.symbol(1, 1, 'myFilter'),
      symbol: { value: 't_1' },
      args: nodes.nodeList(1, 1, [nodes.symbol(1, 1, 'arg1')]),
    };
    compilePipeAsync(ctx, node, frame);
    expect(ctx.emitted).toContain('t_1 = await runtime.awaitValue(env.getFilter("myFilter", 5, 2, 1, 1, "arg1").call(context, ');
  });
});
