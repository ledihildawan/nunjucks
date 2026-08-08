import { describe, test, expect } from 'bun:test';
import { compileIncrement, compileDecrement } from './increment.ts';
import { symbol, literal } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import { loc } from '@nunjucks/shared';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    tmpid: () => { id += 1; return `t_${id}`; },
    compile: (n: { mock?: string }) => { emitted.push(n.mock ?? 'X'); },
  };
};

describe('compileIncrement', () => {
  test('postfix reads current, increments, returns original', () => {
    const c = makeCompiler();
    const node = { lineno: 1, colno: 2, isPostfix: true, target: symbol(loc({ lineno: 1, colno: 2 }), 'i') };
    compileIncrement(asCompiler(c), node as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.contextOrFrameLookup(context, frame, "i")');
    expect(joined).toContain('let result = t_1;');
    expect(joined).toContain('t_1 = t_1 + 1;');
  });

  test('prefix increments then reads', () => {
    const c = makeCompiler();
    const node = { lineno: 1, colno: 2, isPostfix: false, target: symbol(loc({ lineno: 1, colno: 2 }), 'i') };
    compileIncrement(asCompiler(c), node as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('t_1 = t_1 + 1;');
    expect(joined).toContain('let result = t_1;');
  });

  test('non-symbol target throws an invalid-left-hand-side error', () => {
    const c = makeCompiler();
    const node = { lineno: 1, colno: 2, isPostfix: true, target: literal(loc({ lineno: 1, colno: 2 }), 5) };
    compileIncrement(asCompiler(c), node as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('Invalid left-hand side expression');
  });
});

describe('compileDecrement', () => {
  test('uses minus operator', () => {
    const c = makeCompiler();
    const node = { lineno: 1, colno: 2, isPostfix: true, target: symbol(loc({ lineno: 1, colno: 2 }), 'i') };
    compileDecrement(asCompiler(c), node as never, frame);
    expect(c.emitted.join('')).toContain('t_1 = t_1 - 1;');
  });
});