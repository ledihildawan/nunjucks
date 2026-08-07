import { describe, test, expect } from 'bun:test';
import { compileNot, compileNeg, compilePos } from './unary.ts';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    compile: (node: { mock?: string }) => { emitted.push(node.mock as string); },
  };
};

const makeUnary = (mock: string) => ({
  lineno: 5,
  colno: 9,
  target: { mock },
});

const frame = createFrame();

describe('unary emitters', () => {
  test('compileNot wraps target with !', () => {
    const c = makeCompiler();
    compileNot(asCompiler(c), makeUnary('X') as never, frame);
    expect(c.emitted).toEqual(['(lineno = 5, colno = 9, ', '!', 'X', ')']);
  });

  test('compileNeg wraps target with minus', () => {
    const c = makeCompiler();
    compileNeg(asCompiler(c), makeUnary('X') as never, frame);
    expect(c.emitted).toContain('-');
    expect(c.emitted.join('')).toBe('(lineno = 5, colno = 9, -X)');
  });

  test('compilePos wraps target with plus', () => {
    const c = makeCompiler();
    compilePos(asCompiler(c), makeUnary('X') as never, frame);
    expect(c.emitted.join('')).toBe('(lineno = 5, colno = 9, +X)');
  });
});