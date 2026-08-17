import { describe, expect, test } from 'bun:test';
import { literal, pipe, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { loc } from '@nunjucks/shared';
import { asCompiler, makeChainableCompiler } from '../test-helpers.ts';
import { compilePipeForward } from './pipe-forward.ts';
import { makePipeForwardCompiler } from './test-helpers.ts';

const frame = createFrame();

describe('compilePipeForward', () => {
  test('emits runtime.runFilter with filter name and location', () => {
    const c = makePipeForwardCompiler();
    const node = pipe(loc({ lineno: 3, colno: 7 }), {
      name: symbol(loc({ lineno: 3, colno: 7 }), 'upper'),
      args: [{ marker: 'ARG' } as never],
    });
    compilePipeForward(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain(
      'runtime.runFilter({ env, name: "upper", lineno: 3, colno: 7, context, args: ['
    );
    expect(joined).toContain('await runtime.awaitValue(ARG)');
  });

  test('accepts a symbol callee through the real compiler', () => {
    const compiler = makeChainableCompiler();
    const node = pipe(loc({ lineno: 1, colno: 1 }), {
      name: symbol(loc({ lineno: 1, colno: 1 }), 'lower'),
      args: [],
    });
    compiler.compile(node, frame);
    expect(compiler.getCode()).toContain('name: "lower"');
  });

  test('throws when callee is not a symbol', () => {
    const compiler = makeChainableCompiler();
    const node = pipe(loc({ lineno: 1, colno: 1 }), {
      name: literal(loc({ lineno: 1, colno: 1 }), 'x'),
      args: [],
    });
    expect(() => compiler.compile(node, frame)).toThrow('Invalid type assertion');
  });
});
