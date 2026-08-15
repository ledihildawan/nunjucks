import { describe, expect, test } from 'bun:test';
import { createFrame } from '@nunjucks/runtime/frame';
import { asCompiler } from '../test-helpers.ts';
import { compileTest, compileTestCall } from './test-expr.ts';

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => {
      emitted.push(s);
    },
    nextCompilerId: () => {
      id += 1;
      return `t_${id}`;
    },
    compile: (node: { marker?: string }) => {
      emitted.push(node.marker as string);
    },
  };
};

const frame = createFrame();

describe('compileTest', () => {
  test('emits a comma-expression binding test result via runtime.runTest', () => {
    const c = makeCompiler();
    compileTest(asCompiler(c), {
      node: {
        lineno: 3,
        colno: 7,
        name: 'defined',
        target: { marker: 'X' },
      } as never,
      frame,
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('((t_1 = X), ');
    expect(joined).toContain('runtime.runTest(env, "defined", t_1))');
    expect(joined.startsWith('((t_1 = ')).toBe(true);
    expect(joined.endsWith('))')).toBe(true);
  });
});

describe('compileTestCall', () => {
  test('emits runTest with accumulated arg temporaries', () => {
    const c = makeCompiler();
    compileTestCall(asCompiler(c), {
      node: {
        target: { marker: 'X' },
        name: 'divisibleby',
        args: [{ marker: 'N' }, { marker: 'M' }],
        lineno: 4,
        colno: 2,
      } as never,
      frame,
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('(t_1 = X, ');
    expect(joined).toContain('t_2 = N, ');
    expect(joined).toContain('t_3 = M, ');
    expect(joined).toContain('runtime.runTest(env, "divisibleby", t_1, t_2, t_3))');
    expect(joined.endsWith('))')).toBe(true);
  });

  test('skips null args', () => {
    const c = makeCompiler();
    compileTestCall(asCompiler(c), {
      node: {
        target: { marker: 'X' },
        name: 'odd',
        args: [null],
        lineno: 1,
        colno: 1,
      } as never,
      frame,
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.runTest(env, "odd", t_1))');
    expect(joined).not.toContain('t_2');
  });
});
