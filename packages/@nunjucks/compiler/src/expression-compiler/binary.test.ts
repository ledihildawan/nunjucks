import { describe, expect, test } from 'bun:test';
import type { Node } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { asCompiler } from '../test-helpers.ts';
import {
  compileAdd,
  compileAnd,
  compileMul,
  compileOr,
  compileRange,
  compileSub,
} from './binary.ts';
import { makeMarkerCompiler } from './test-helpers.ts';

interface FakeNode {
  marker: string;
  lineno: number;
  colno: number;
  left: Node | FakeNode;
  right: Node | FakeNode;
}

const makeNode = (leftMarker: string, rightMarker: string): FakeNode => ({
  marker: 'ignored',
  lineno: 5,
  colno: 9,
  left: { marker: leftMarker } as unknown as Node,
  right: { marker: rightMarker } as unknown as Node,
});

const frame = createFrame();

describe('binary emitters', () => {
  test('compileAdd emits location guard, operands joined by " + "', () => {
    const c = makeMarkerCompiler();
    compileAdd(asCompiler(c), { node: makeNode('L', 'R') as never, frame });
    expect(c.emitted).toEqual(['(lineno = 5, colno = 9, ', 'L', ' + ', 'R', ')']);
  });

  test('compileSub emits the subtraction operator', () => {
    const c = makeMarkerCompiler();
    compileSub(asCompiler(c), { node: makeNode('a', 'b') as never, frame });
    expect(c.emitted).toContain(' - ');
    expect(c.emitted[c.emitted.length - 1]).toBe(')');
  });

  test('compileMul emits the multiplication operator', () => {
    const c = makeMarkerCompiler();
    compileMul(asCompiler(c), { node: makeNode('a', 'b') as never, frame });
    expect(c.emitted).toContain(' * ');
  });

  test('compileOr emits the logical-or operator', () => {
    const c = makeMarkerCompiler();
    compileOr(asCompiler(c), { node: makeNode('x', 'y') as never, frame });
    expect(c.emitted).toContain(' || ');
  });

  test('compileAnd emits the logical-and operator', () => {
    const c = makeMarkerCompiler();
    compileAnd(asCompiler(c), { node: makeNode('x', 'y') as never, frame });
    expect(c.emitted).toContain(' && ');
  });

  test('every binary emission starts with the location guard and ends with ")"', () => {
    const c = makeMarkerCompiler();
    compileAdd(asCompiler(c), { node: makeNode('L', 'R') as never, frame });
    expect(c.emitted[0]).toBe('(lineno = 5, colno = 9, ');
    expect(c.emitted[c.emitted.length - 1]).toBe(')');
    expect(c.emitted.join('')).toBe('(lineno = 5, colno = 9, L + R)');
  });
});

describe('compileRange', () => {
  test('guards integer bounds and span before the materialization loop', () => {
    const c = makeMarkerCompiler();
    compileRange(asCompiler(c), {
      node: { ...makeNode('S', 'E'), lineno: 2, colno: 6 } as never,
      frame,
    });
    const code = c.emitted.join('');
    expect(code.startsWith('(lineno = 2, colno = 6, ')).toBe(true);
    expect(code).toContain('Number.isInteger(s)');
    expect(code).toContain('Number.isInteger(e)');
    expect(code).toContain('Math.abs(e - s) > 1000000');
    expect(code).toContain('rangeError.code = "RANGE_EXCEEDED"');
    const guardPos = code.indexOf('Number.isInteger');
    const loopPos = code.indexOf('r.push(i)');
    expect(guardPos).toBeGreaterThan(-1);
    expect(loopPos).toBeGreaterThan(guardPos);
  });
});
