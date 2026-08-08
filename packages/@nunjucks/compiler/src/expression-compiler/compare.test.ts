import { describe, test, expect } from 'bun:test';
import { compileCompare, compileIs } from './compare.ts';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    compile: (node: { mock?: string }) => { emitted.push(node.mock as string); },
  };
};
const frame = createFrame();

describe('compileCompare', () => {
  test('emits location guard, expr, then each operator with operand and closing parens', () => {
    const c = makeCompiler();
    const node = {
      expr: { mock: 'EXPR' },
      ops: [{ operator: '==', expr: { mock: 'R1' }, lineno: 5, colno: 9 }],
      lineno: 1, colno: 1,
    };
    compileCompare(asCompiler(c), { node: node as never, frame });
    expect(c.emitted).toEqual([
      '(lineno = 5, colno = 9, ', 'EXPR',
      ' == ', '(lineno = 5, colno = 9, ', 'R1', ')',
      ')',
    ]);
  });

  test('chains multiple operands with one ")" per op plus a trailing ")"', () => {
    const c = makeCompiler();
    const node = {
      expr: { mock: 'X' },
      ops: [
        { operator: '<', expr: { mock: 'A' }, lineno: 1, colno: 1 },
        { operator: '<=', expr: { mock: 'B' }, lineno: 2, colno: 2 },
      ],
      lineno: 0, colno: 0,
    };
    compileCompare(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toBe('(lineno = 1, colno = 1, X < (lineno = 1, colno = 1, A) <= (lineno = 2, colno = 2, B))');
  });
});

describe('compileIs', () => {
  test('emits env.getTest call wrapping the left operand and closes with "=== true)"', () => {
    const c = makeCompiler();
    const node = {
      left: { mock: 'LEFT' },
      right: { value: 'defined' },
      lineno: 7, colno: 3,
    };
    compileIs(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('env.getTest("defined", 7, 3).call(context, ');
    expect(joined).toContain('LEFT');
    expect(joined.endsWith(') === true)')).toBe(true);
  });
});
