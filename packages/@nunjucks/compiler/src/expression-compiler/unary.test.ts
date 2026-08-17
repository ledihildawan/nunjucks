import { describe, expect, test } from 'bun:test';
import { createFrame } from '@nunjucks/runtime';
import { asCompiler } from '../test-helpers.ts';
import { compileNeg, compileNot, compilePos } from './unary.ts';
import { makeMarkerCompiler } from './test-helpers.ts';

const makeUnary = (marker: string) => ({
  lineno: 5,
  colno: 9,
  target: { marker },
});

const frame = createFrame();

describe('unary emitters', () => {
  test('compileNot wraps target with !', () => {
    const c = makeMarkerCompiler();
    compileNot(asCompiler(c), { node: makeUnary('X') as never, frame });
    expect(c.emitted).toEqual(['(lineno = 5, colno = 9, ', '(!runtime.isTruthy(', 'X', ')))']);
  });

  test('compileNeg wraps target with minus', () => {
    const c = makeMarkerCompiler();
    compileNeg(asCompiler(c), { node: makeUnary('X') as never, frame });
    expect(c.emitted).toContain('-');
    expect(c.emitted.join('')).toBe('(lineno = 5, colno = 9, -X)');
  });

  test('compilePos wraps target with plus', () => {
    const c = makeMarkerCompiler();
    compilePos(asCompiler(c), { node: makeUnary('X') as never, frame });
    expect(c.emitted.join('')).toBe('(lineno = 5, colno = 9, +X)');
  });
});
