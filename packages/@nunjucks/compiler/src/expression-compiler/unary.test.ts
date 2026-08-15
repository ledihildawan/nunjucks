import { describe, expect, test } from 'bun:test';
import { createFrame } from '@nunjucks/runtime/frame';
import { asCompiler } from '../test-helpers.ts';
import { compileNeg, compileNot, compilePos } from './unary.ts';

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => {
      emitted.push(s);
    },
    compile: (node: { marker?: string }) => {
      emitted.push(node.marker as string);
    },
  };
};

const makeUnary = (marker: string) => ({
  lineno: 5,
  colno: 9,
  target: { marker },
});

const frame = createFrame();

describe('unary emitters', () => {
  test('compileNot wraps target with !', () => {
    const c = makeCompiler();
    compileNot(asCompiler(c), { node: makeUnary('X') as never, frame });
    expect(c.emitted).toEqual(['(lineno = 5, colno = 9, ', '!', 'X', ')']);
  });

  test('compileNeg wraps target with minus', () => {
    const c = makeCompiler();
    compileNeg(asCompiler(c), { node: makeUnary('X') as never, frame });
    expect(c.emitted).toContain('-');
    expect(c.emitted.join('')).toBe('(lineno = 5, colno = 9, -X)');
  });

  test('compilePos wraps target with plus', () => {
    const c = makeCompiler();
    compilePos(asCompiler(c), { node: makeUnary('X') as never, frame });
    expect(c.emitted.join('')).toBe('(lineno = 5, colno = 9, +X)');
  });
});
