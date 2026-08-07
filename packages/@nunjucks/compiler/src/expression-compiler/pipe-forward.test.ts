import { describe, test, expect } from 'bun:test';
import { compilePipeForward } from './pipe-forward.ts';
import { symbol, literal, pipe } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';

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
  test('emits env.getFilter with filter name and location', () => {
    const c = makeCompiler();
    const node = pipe(3, 7, symbol(3, 7, 'upper'), [{ mock: 'ARG' } as never]);
    compilePipeForward(asCompiler(c), node as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('env.getFilter("upper", 3, 7)');
    expect(joined).toContain('await runtime.awaitValue(ARG)');
  });

  test('asserts the callee is a symbol', () => {
    const c = makeCompiler();
    let assertedType = '';
    const c2 = { ...c, assertType: (_n: unknown, ...types: string[]) => { assertedType = types.join(','); } };
    const node = pipe(1, 1, symbol(1, 1, 'lower'), []);
    compilePipeForward(asCompiler(c2), node as never, frame);
    expect(assertedType).toBe('symbol');
  });

  test('throws when callee is not a symbol', () => {
    const c = makeCompiler();
    const failing = { ...c, assertType: () => { throw new Error('assertType: invalid type'); } };
    const node = pipe(1, 1, literal(1, 1, 'x'), []);
    expect(() => compilePipeForward(asCompiler(failing), node as never, frame)).toThrow('assertType');
  });
});