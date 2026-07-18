import { describe, test, expect } from 'bun:test';
import { compileCompare, compileIs } from './compare.js';
import { nodes } from '../../nodes/index.js';

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
      ops: [{ lineno: 2, colno: 4, operator: '==', expr: { mock: 'right' } }],
    };
    compileCompare(ctx, node);
    expect(ctx.emitted).toEqual(['(lineno = 2, colno = 4, ', 'left', ' == (lineno = 2, colno = 4, ', 'right', ')', ')']);
  });

  test('compiles expression with multiple operators', () => {
    const ctx = makeCtx();
    const node = {
      expr: { mock: 'x' },
      ops: [
        { lineno: 1, colno: 2, operator: '<', expr: { mock: 'y' } },
        { lineno: 1, colno: 6, operator: '<', expr: { mock: 'z' } },
      ],
    };
    compileCompare(ctx, node);
    expect(ctx.emitted).toEqual([
      '(lineno = 1, colno = 2, ', 'x',
      ' < (lineno = 1, colno = 2, ', 'y', ')',
      ' < (lineno = 1, colno = 6, ', 'z', ')', ')'
    ]);
  });

  test('handles all comparison operators', () => {
    const ops = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];
    for (const op of ops) {
      const ctx = makeCtx();
      compileCompare(ctx, {
        expr: { mock: 'a' },
        ops: [{ operator: op, expr: { mock: 'b' } }],
      });
      expect(ctx.emitted[2]).toContain(` ${op} `);
    }
  });
});

describe('compileIs', () => {
  test('compiles test with name', () => {
    const ctx = makeCtx();
    const node = {
      left: { mock: 'val' },
      right: nodes.symbol(1, 1, 'odd'),
    };
    compileIs(ctx, node);
    expect(ctx.emitted).toEqual([
      '(lineno = 0, colno = 0, env.getTest("odd", 0, 0).call(context, ',
      'val',
      ') === true)',
    ]);
  });

  test('escapes test names and forwards location', () => {
    const ctx = makeCtx();
    compileIs(ctx, {
      lineno: 4,
      colno: 9,
      left: { mock: 'val' },
      right: nodes.symbol(4, 12, 'a"b\\c'),
    });
    expect(ctx.emitted[0]).toBe('(lineno = 4, colno = 9, env.getTest("a\\"b\\\\c", 4, 9).call(context, ');
  });

  test('compiles test with args', () => {
    const ctx = makeCtx();
    const node = {
      left: { mock: 'val' },
      right: {
        name: nodes.symbol(1, 1, 'divisibleby'),
        args: { mock: '[2]' },
      },
    };
    compileIs(ctx, node);
    expect(ctx.emitted).toEqual([
      '(lineno = 0, colno = 0, env.getTest("divisibleby", 0, 0).call(context, ',
      'val',
      ',',
      '[2]',
      ') === true)',
    ]);
  });
});
