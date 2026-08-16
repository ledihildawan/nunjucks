import { describe, expect, test } from 'bun:test';
import { createFrame } from '@nunjucks/runtime';
import { asCompiler } from '../test-helpers.ts';
import { compileCompare, compileIs } from './compare.ts';

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => {
      emitted.push(s);
    },
    emitLine: (s: string) => {
      emitted.push(`${s}\n`);
    },
    compile: (node: { marker?: string }) => {
      emitted.push(node.marker as string);
    },
  };
};
const frame = createFrame();

describe('compileCompare', () => {
  test('emits location guard, expr, then each operator with operand and closing parens', () => {
    const c = makeCompiler();
    const node = {
      expr: { marker: 'EXPR' },
      ops: [
        { type: 'compareOperand', operator: '==', expr: { marker: 'R1' }, lineno: 5, colno: 9 },
      ],
      lineno: 1,
      colno: 1,
    };
    compileCompare(asCompiler(c), { node: node as never, frame });
    expect(c.emitted).toEqual([
      '(lineno = 5, colno = 9, ',
      'EXPR',
      ' == ',
      '(lineno = 5, colno = 9, ',
      'R1',
      ')',
      ')',
    ]);
  });

  test('chains multiple operands with one ")" per op plus a trailing ")"', () => {
    const c = makeCompiler();
    const node = {
      expr: { marker: 'X' },
      ops: [
        { type: 'compareOperand', operator: '<', expr: { marker: 'A' }, lineno: 1, colno: 1 },
        { type: 'compareOperand', operator: '<=', expr: { marker: 'B' }, lineno: 2, colno: 2 },
      ],
      lineno: 0,
      colno: 0,
    };
    compileCompare(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toBe(
      '(lineno = 1, colno = 1, X < (lineno = 1, colno = 1, A) <= (lineno = 2, colno = 2, B))'
    );
  });
});

describe('compileIs', () => {
  test('emits env.getTest call wrapping the left operand and closes with "=== true)"', () => {
    const c = makeCompiler();
    const node = {
      left: { marker: 'LEFT' },
      right: { value: 'defined' },
      lineno: 7,
      colno: 3,
    };
    compileIs(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('env.getTest("defined", 7, 3).call(context, ');
    expect(joined).toContain('LEFT');
    expect(joined.endsWith(') === true)')).toBe(true);
  });
});
