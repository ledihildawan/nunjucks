import { describe, expect, test } from 'bun:test';
import { literal, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime/frame';
import { loc } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { compileDecrement, compileIncrement } from './increment.ts';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => {
      emitted.push(s);
    },
    emitLine: (s: string) => {
      emitted.push(`${s}\n`);
    },
    nextCompilerId: () => {
      id += 1;
      return `t_${id}`;
    },
    compile: (n: { marker?: string }) => {
      emitted.push(n.marker ?? 'X');
    },
  };
};

describe('compileIncrement', () => {
  test('postfix reads current, increments, returns original', () => {
    const c = makeCompiler();
    const node = {
      lineno: 1,
      colno: 2,
      isPostfix: true,
      target: symbol(loc({ lineno: 1, colno: 2 }), 'i'),
    };
    compileIncrement(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.contextOrFrameLookup(context, frame, "i")');
    expect(joined).toContain('let result = t_1;');
    expect(joined).toContain('t_1 = t_1 + 1;');
  });

  test('prefix increments then reads', () => {
    const c = makeCompiler();
    const node = {
      lineno: 1,
      colno: 2,
      isPostfix: false,
      target: symbol(loc({ lineno: 1, colno: 2 }), 'i'),
    };
    compileIncrement(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('t_1 = t_1 + 1;');
    expect(joined).toContain('let result = t_1;');
  });

  test('non-symbol target throws an invalid-left-hand-side error', () => {
    const c = makeCompiler();
    const node = {
      lineno: 1,
      colno: 2,
      isPostfix: true,
      target: literal(loc({ lineno: 1, colno: 2 }), 5),
    };
    compileIncrement(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('Invalid left-hand side expression');
    expect(joined).toContain('err.code = "INVALID_ASSIGN_TARGET"');
  });
});

describe('compileDecrement', () => {
  test('uses minus operator', () => {
    const c = makeCompiler();
    const node = {
      lineno: 1,
      colno: 2,
      isPostfix: true,
      target: symbol(loc({ lineno: 1, colno: 2 }), 'i'),
    };
    compileDecrement(asCompiler(c), { node: node as never, frame });
    expect(c.emitted.join('')).toContain('t_1 = t_1 - 1;');
  });
});
