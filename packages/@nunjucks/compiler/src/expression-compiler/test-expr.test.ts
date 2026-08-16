import { describe, expect, test } from 'bun:test';
import { createFrame } from '@nunjucks/runtime';
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
  test('declares the target temporary with let and binds the test result via runtime.runTest', () => {
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
    expect(joined).toContain('(await (async () => { let t_1 = X; return ');
    expect(joined).toContain('(lineno = 3, colno = 7, ');
    expect(joined).toContain('runtime.runTest(env, "defined", t_1)); })())');
    expect(joined.startsWith('(await (async () => { let t_1 = ')).toBe(true);
    expect(joined.endsWith('})())')).toBe(true);
    expect(joined.split('t_1 =').length - 1).toBe(joined.split('let t_1 =').length - 1);
  });
});

describe('compileTestCall', () => {
  test('declares target and arg temporaries with let inside an async IIFE', () => {
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
    expect(joined).toContain('let t_1 = X;');
    expect(joined).toContain('let t_2 = N;');
    expect(joined).toContain('let t_3 = M;');
    expect(joined).toContain('runtime.runTest(env, "divisibleby", t_1, t_2, t_3)); })())');
    expect(joined.endsWith('})())')).toBe(true);
    for (const tmp of ['t_1', 't_2', 't_3']) {
      expect(joined.split(`${tmp} =`).length - 1).toBe(joined.split(`let ${tmp} =`).length - 1);
    }
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
