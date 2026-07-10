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
    compileNot(ctx, { target: { name: 'cond' } });
    expect(ctx.emitted).toEqual(['!', '[cond]']);
  });
});

describe('compileNeg', () => {
  test('emits - followed by target', () => {
    const ctx = makeCtx();
    compileNeg(ctx, { target: { name: 'val' } });
    expect(ctx.emitted).toEqual(['-', '[val]']);
  });
});

describe('compilePos', () => {
  test('emits + followed by target', () => {
    const ctx = makeCtx();
    compilePos(ctx, { target: { name: 'val' } });
    expect(ctx.emitted).toEqual(['+', '[val]']);
  });
});
