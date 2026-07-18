import { describe, test, expect } from 'bun:test';
import {
  compileOr, compileAnd, compileAdd, compileConcat,
  compileSub, compileMul, compileDiv, compileMod,
  compileNullishCoalesce, compileIn, compileFloorDiv, compilePow,
} from './binary.js';

const makeCtx = () => {
  const emitted = [];
  const compile = (node) => emitted.push(node.mock);
  return { emitted, _emit: (s) => emitted.push(s), compile };
};

const leftNode = { mock: '[left]' };
const rightNode = { mock: '[right]' };

describe('binary operators', () => {
  test('compileOr emits ||', () => {
    const ctx = makeCtx();
    compileOr(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['[left]', ' || ', '[right]']);
  });

  test('compileAnd emits &&', () => {
    const ctx = makeCtx();
    compileAnd(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['[left]', ' && ', '[right]']);
  });

  test('compileAdd emits +', () => {
    const ctx = makeCtx();
    compileAdd(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['[left]', ' + ', '[right]']);
  });

  test('compileConcat emits + "" +', () => {
    const ctx = makeCtx();
    compileConcat(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['[left]', ' + "" + ', '[right]']);
  });

  test('compileSub emits -', () => {
    const ctx = makeCtx();
    compileSub(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['[left]', ' - ', '[right]']);
  });

  test('compileMul emits *', () => {
    const ctx = makeCtx();
    compileMul(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['[left]', ' * ', '[right]']);
  });

  test('compileDiv emits /', () => {
    const ctx = makeCtx();
    compileDiv(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['[left]', ' / ', '[right]']);
  });

  test('compileMod emits %', () => {
    const ctx = makeCtx();
    compileMod(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['[left]', ' % ', '[right]']);
  });

  test('compileNullishCoalesce emits runtime.nullishCoalesce()', () => {
    const ctx = makeCtx();
    compileNullishCoalesce(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['runtime.nullishCoalesce(', '[left]', ',', '[right]', ')']);
  });

  test('compileIn emits runtime.inOperator()', () => {
    const ctx = makeCtx();
    compileIn(ctx, { lineno: 3, colno: 7, left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['(lineno = 3, colno = 7, runtime.inOperator(', '[left]', ',', '[right]', ', 3, 7))']);
  });

  test('compileFloorDiv emits Math.floor()', () => {
    const ctx = makeCtx();
    compileFloorDiv(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['Math.floor(', '[left]', ' / ', '[right]', ')']);
  });

  test('compilePow emits Math.pow()', () => {
    const ctx = makeCtx();
    compilePow(ctx, { left: leftNode, right: rightNode });
    expect(ctx.emitted).toEqual(['Math.pow(', '[left]', ', ', '[right]', ')']);
  });
});
