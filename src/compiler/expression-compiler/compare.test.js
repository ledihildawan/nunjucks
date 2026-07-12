import { describe, test, expect } from 'bun:test';
import { compileCompare, compileIs } from './compare.js';
import { AstSymbol } from '../../nodes/index.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    compile: (node) => emitted.push(node.mock),
    _compileExpression: (node) => emitted.push(node.mock),
  };
};

describe('compileCompare', () => {
  test('compiles expression with single operator', () => {
    const ctx = makeCtx();
    const node = {
      expr: { mock: 'left' },
      ops: [{ type: '==', expr: { mock: 'right' } }],
    };
    compileCompare(ctx, node);
    expect(ctx.emitted).toEqual(['left', ' == ', 'right']);
  });

  test('compiles expression with multiple operators', () => {
    const ctx = makeCtx();
    const node = {
      expr: { mock: 'x' },
      ops: [
        { type: '<', expr: { mock: 'y' } },
        { type: '<', expr: { mock: 'z' } },
      ],
    };
    compileCompare(ctx, node);
    expect(ctx.emitted).toEqual(['x', ' < ', 'y', ' < ', 'z']);
  });

  test('handles all comparison operators', () => {
    const ops = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];
    for (const op of ops) {
      const ctx = makeCtx();
      compileCompare(ctx, {
        expr: { mock: 'a' },
        ops: [{ type: op, expr: { mock: 'b' } }],
      });
      expect(ctx.emitted[1].trim()).toBe(op);
    }
  });
});

describe('compileIs', () => {
  test('compiles test with name', () => {
    const ctx = makeCtx();
    const node = {
      left: { mock: 'val' },
      right: AstSymbol(1, 1, 'odd'),
    };
    compileIs(ctx, node);
    expect(ctx.emitted).toEqual([
      'env.getTest("odd").call(context, ',
      'val',
      ') === true',
    ]);
  });

  test('compiles test with args', () => {
    const ctx = makeCtx();
    const node = {
      left: { mock: 'val' },
      right: {
        name: AstSymbol(1, 1, 'divisibleby'),
        args: { mock: '[2]' },
      },
    };
    compileIs(ctx, node);
    expect(ctx.emitted).toEqual([
      'env.getTest("divisibleby").call(context, ',
      'val',
      ',',
      '[2]',
      ') === true',
    ]);
  });
});
