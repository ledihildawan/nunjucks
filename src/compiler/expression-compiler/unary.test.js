import { describe, test, expect } from 'bun:test';
import { compileNot, compileNeg, compilePos } from './unary.js';

const makeCtx = () => {
  const emitted = [];
  return {
    emitted,
    _emit: (s) => emitted.push(s),
    compile: (node) => emitted.push(`[${node.name}]`),
  };
};

describe('compileNot', () => {
  test('emits ! followed by target', () => {
    const ctx = makeCtx();
    compileNot(ctx, { lineno: 2, colno: 4, target: { name: 'cond' } });
    expect(ctx.emitted).toEqual(['(lineno = 2, colno = 4, !', '[cond]', ')']);
  });
});

describe('compileNeg', () => {
  test('emits - followed by target', () => {
    const ctx = makeCtx();
    compileNeg(ctx, { target: { name: 'val' } });
    expect(ctx.emitted).toEqual(['(lineno = 0, colno = 0, -', '[val]', ')']);
  });
});

describe('compilePos', () => {
  test('emits + followed by target', () => {
    const ctx = makeCtx();
    compilePos(ctx, { target: { name: 'val' } });
    expect(ctx.emitted).toEqual(['(lineno = 0, colno = 0, +', '[val]', ')']);
  });
});
