import { describe, test, expect } from 'bun:test';
import { compileInlineIf, compileWalrus } from './inline.ts';
import { symbol, literal, lookupVal } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import { loc } from '@nunjucks/shared';

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    tmpid: () => { id += 1; return `t_${id}`; },
    compile: (node: { mock?: string }) => { emitted.push(node.mock as string); },
    fail: (msg: string) => { throw new Error(msg); },
  };
};

const frame = createFrame();

describe('compileInlineIf', () => {
  test('emits cond ? body : alternate', () => {
    const c = makeCompiler();
    compileInlineIf(asCompiler(c), {
      node: {
        cond: { mock: 'C' },
        body: { mock: 'B' },
        alternate: { mock: 'E' },
      } as never,
      frame,
    });
    expect(c.emitted.join('')).toBe('(C?B:E)');
  });

  test('emits "" when alternate is null', () => {
    const c = makeCompiler();
    compileInlineIf(asCompiler(c), {
      node: {
        cond: { mock: 'C' },
        body: { mock: 'B' },
        alternate: null,
      } as never,
      frame,
    });
    expect(c.emitted.join('')).toBe('(C?B:"")');
  });
});

describe('compileWalrus', () => {
  test('symbol target emits a scoped frame.set and returns the value', () => {
    const c = makeCompiler();
    compileWalrus(asCompiler(c), {
      node: {
        lineno: 2, colno: 4,
        target: symbol(loc({ lineno: 2, colno: 4 }), 'x'),
        value: { mock: 'V' },
      } as never,
      frame,
    });
    const joined = c.emitted.join('');
    expect(joined).toContain('let t_1 = V;');
    expect(joined).toContain('frame = frame.set("x", t_1, true);');
    expect(joined).toContain('return t_1;');
  });

  test('non-symbol non-pattern target fails', () => {
    const c = makeCompiler();
    expect(() => compileWalrus(asCompiler(c), {
      node: {
        lineno: 1, colno: 1,
        target: lookupVal(loc({ lineno: 1, colno: 1 }), { target: symbol(loc({ lineno: 1, colno: 1 }), 'a'), val: literal(loc({ lineno: 1, colno: 1 }), 'b') }),
        value: { mock: 'V' },
      } as never,
      frame,
    })).toThrow(/Walrus target must be a symbol/);
  });
});