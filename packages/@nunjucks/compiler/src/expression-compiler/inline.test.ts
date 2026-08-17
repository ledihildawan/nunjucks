import { describe, expect, test } from 'bun:test';
import { literal, lookupVal, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { loc } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileInlineIf, compileWalrus } from './inline.ts';
import { makeInlineCompiler } from './test-helpers.ts';

const frame = createFrame();

describe('compileInlineIf', () => {
  test('emits cond ? body : alternate', () => {
    const c = makeInlineCompiler();
    compileInlineIf(asCompiler(c), {
      node: {
        cond: { marker: 'C' },
        body: { marker: 'B' },
        alternate: { marker: 'E' },
      } as never,
      frame,
    });
    expect(c.emitted.join('')).toBe('(runtime.isTruthy(C)?B:E)');
  });

  test('emits "" when alternate is null', () => {
    const c = makeInlineCompiler();
    compileInlineIf(asCompiler(c), {
      node: {
        cond: { marker: 'C' },
        body: { marker: 'B' },
        alternate: null,
      } as never,
      frame,
    });
    expect(c.emitted.join('')).toBe('(runtime.isTruthy(C)?B:"")');
  });
});

describe('compileWalrus', () => {
  test('symbol target emits a scoped frame.set and returns the value', () => {
    const c = makeInlineCompiler();
    compileWalrus(asCompiler(c), {
      node: {
        lineno: 2,
        colno: 4,
        target: symbol(loc({ lineno: 2, colno: 4 }), 'x'),
        value: { marker: 'V' },
      } as never,
      frame,
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('let t_1 = V;');
    expect(joined).toContain('frame = frame.set({ name: "x", value: t_1, resolveUp: true });');
    expect(joined).toContain('return t_1;');
  });

  test('non-symbol non-pattern target fails', () => {
    const c = makeInlineCompiler();
    expect(() =>
      compileWalrus(asCompiler(c), {
        node: {
          lineno: 1,
          colno: 1,
          target: lookupVal(loc({ lineno: 1, colno: 1 }), {
            target: symbol(loc({ lineno: 1, colno: 1 }), 'a'),
            val: literal(loc({ lineno: 1, colno: 1 }), 'b'),
          }),
          value: { marker: 'V' },
        } as never,
        frame,
      })
    ).toThrow(/Walrus target must be a symbol/);
  });
});
