import { describe, test, expect } from 'bun:test';
import { compilePipeForward } from './pipe-forward.ts';
import { symbol, literal, pipe } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import { loc } from '@nunjucks/shared';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    assertType: () => {},
    compile: (n: { mock?: string }) => { emitted.push(n.mock ?? 'X'); },
  };
};

describe('compilePipeForward', () => {
  test('emits runtime.runFilter with filter name and location', () => {
    const c = makeCompiler();
    const node = pipe(loc({ lineno: 3, colno: 7 }), { name: symbol(loc({ lineno: 3, colno: 7 }), 'upper'), args: [{ mock: 'ARG' } as never] });
    compilePipeForward(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.runFilter({ env, name: "upper", lineno: 3, colno: 7, context, args: [');
    expect(joined).toContain('await runtime.awaitValue(ARG)');
  });

  test('asserts the callee is a symbol', () => {
    const c = makeCompiler();
    let assertedType = '';
    const c2 = { ...c, assertType: (_n: unknown, ...types: string[]) => { assertedType = types.join(','); } };
    const node = pipe(loc({ lineno: 1, colno: 1 }), { name: symbol(loc({ lineno: 1, colno: 1 }), 'lower'), args: [] });
    compilePipeForward(asCompiler(c2), { node: node as never, frame });
    expect(assertedType).toBe('symbol');
  });

  test('throws when callee is not a symbol', () => {
    const c = makeCompiler();
    const failing = { ...c, assertType: () => { throw new Error('assertType: invalid type'); } };
    const node = pipe(loc({ lineno: 1, colno: 1 }), { name: literal(loc({ lineno: 1, colno: 1 }), 'x'), args: [] });
    expect(() => compilePipeForward(asCompiler(failing), { node: node as never, frame })).toThrow('assertType');
  });
});