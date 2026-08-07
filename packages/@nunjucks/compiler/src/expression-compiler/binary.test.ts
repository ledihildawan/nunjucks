import { describe, test, expect } from 'bun:test';
import { compileAdd, compileSub, compileMul, compileOr, compileAnd } from './binary.ts';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import type { Node } from '@nunjucks/nodes';

interface MockNode {
  mock: string;
  lineno: number;
  colno: number;
  left: Node | MockNode;
  right: Node | MockNode;
}

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    compile: (node: Node | MockNode) => { emitted.push((node as MockNode).mock); },
  };
};

const makeNode = (leftMock: string, rightMock: string): MockNode => ({
  mock: 'ignored',
  lineno: 5,
  colno: 9,
  left: { mock: leftMock } as unknown as Node,
  right: { mock: rightMock } as unknown as Node,
});

const frame = createFrame();

describe('binary emitters', () => {
  test('compileAdd emits location guard, operands joined by " + "', () => {
    const c = makeCompiler();
    compileAdd(asCompiler(c), makeNode('L', 'R') as never, frame);
    expect(c.emitted).toEqual(['(lineno = 5, colno = 9, ', 'L', ' + ', 'R', ')']);
  });

  test('compileSub emits the subtraction operator', () => {
    const c = makeCompiler();
    compileSub(asCompiler(c), makeNode('a', 'b') as never, frame);
    expect(c.emitted).toContain(' - ');
    expect(c.emitted[c.emitted.length - 1]).toBe(')');
  });

  test('compileMul emits the multiplication operator', () => {
    const c = makeCompiler();
    compileMul(asCompiler(c), makeNode('a', 'b') as never, frame);
    expect(c.emitted).toContain(' * ');
  });

  test('compileOr emits the logical-or operator', () => {
    const c = makeCompiler();
    compileOr(asCompiler(c), makeNode('x', 'y') as never, frame);
    expect(c.emitted).toContain(' || ');
  });

  test('compileAnd emits the logical-and operator', () => {
    const c = makeCompiler();
    compileAnd(asCompiler(c), makeNode('x', 'y') as never, frame);
    expect(c.emitted).toContain(' && ');
  });

  test('every binary emission starts with the location guard and ends with ")"', () => {
    const c = makeCompiler();
    compileAdd(asCompiler(c), makeNode('L', 'R') as never, frame);
    expect(c.emitted[0]).toBe('(lineno = 5, colno = 9, ');
    expect(c.emitted[c.emitted.length - 1]).toBe(')');
    expect(c.emitted.join('')).toBe('(lineno = 5, colno = 9, L + R)');
  });
});
