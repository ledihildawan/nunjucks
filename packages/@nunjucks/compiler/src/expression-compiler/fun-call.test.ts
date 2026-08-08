import { describe, test, expect } from 'bun:test';
import { compileFunCall } from './fun-call.ts';
import { symbol, literal, funCall } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import { loc } from '@nunjucks/shared';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    compile: (n: { mock?: string }) => { emitted.push(n.mock ?? 'X'); },
    compileExpression: (n: { mock?: string }) => { emitted.push(n.mock ?? 'X'); },
  };
};

describe('compileFunCall', () => {
  test('symbol callee emits runtime.callWrap with display name', () => {
    const c = makeCompiler();
    const node = funCall(loc({ lineno: 5, colno: 9 }), { name: symbol(loc({ lineno: 5, colno: 9 }), 'greet'), args: [literal(loc({ lineno: 5, colno: 9 }), 'World')] });
    compileFunCall(asCompiler(c), node as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.callWrap(');
    expect(joined).toContain('"greet"');
    expect(joined).toContain('"greet()"');
    expect(joined).toContain('], lineno: 5, colno: 9 }))');
  });

  test('literal callee uses its value as display name', () => {
    const c = makeCompiler();
    const node = funCall(loc({ lineno: 1, colno: 1 }), { name: literal(loc({ lineno: 1, colno: 1 }), 'fn'), args: [] });
    compileFunCall(asCompiler(c), node as never, frame);
    const joined = c.emitted.join('');
    expect(joined).toContain('"fn"');
    expect(joined).toContain('"fn()"');
  });
});