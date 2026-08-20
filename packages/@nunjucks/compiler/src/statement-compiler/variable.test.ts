import { describe, expect, test } from 'bun:test';
import { literal, symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { loc, ZERO_LOC } from '@nunjucks/shared';
import { asCompiler } from '../test-helpers.ts';
import { makeVariableCompiler } from './test-helpers.ts';
import {
  compileCompoundAssignment,
  compileVariableAssignment,
  compileVariableDeclaration,
} from './variable.ts';

const frame = createFrame();

const declNode = (name: string, valueMarker: string) => ({
  targets: [symbol(ZERO_LOC, name)],
  value: { marker: valueMarker },
});

describe('compileVariableDeclaration', () => {
  test('emits frame.set with the value', () => {
    const c = makeVariableCompiler();
    compileVariableDeclaration(asCompiler(c), { node: declNode('x', 'V') as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('let t_1 =');
    expect(joined).toContain('V;');
    expect(joined).toContain('frame = frame.set({ name: "x", value: t_1, resolveUp: true });');
  });
});

describe('compileVariableAssignment', () => {
  test('emits a ReferenceError guard for undeclared variables', () => {
    const c = makeVariableCompiler();
    compileVariableAssignment(asCompiler(c), { node: declNode('x', 'V') as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('ReferenceError');
    expect(joined).toContain('Use x := value to declare it');
    expect(joined).toContain('frame = frame.set({ name: "x"');
  });
});

describe('compileCompoundAssignment', () => {
  test("'+=' emits the plus operator and frame.set", () => {
    const c = makeVariableCompiler();
    const node = {
      targets: [symbol(loc({ lineno: 1, colno: 2 }), 'count')],
      operator: '+=',
      value: literal(loc({ lineno: 1, colno: 2 }), 1),
      lineno: 1,
      colno: 2,
    };
    compileCompoundAssignment(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.contextOrFrameLookup(context, frame, "count")');
    expect(joined).toContain('t_2 = t_1 +');
    expect(joined).toContain('frame = frame.set({ name: "count"');
  });

  test('//= emits Math.floor division', () => {
    const c = makeVariableCompiler();
    const node = {
      targets: [symbol(loc({ lineno: 1, colno: 2 }), 'n')],
      operator: '//=',
      value: literal(loc({ lineno: 1, colno: 2 }), 2),
      lineno: 1,
      colno: 2,
    };
    compileCompoundAssignment(asCompiler(c), { node: node as never, frame });
    expect(c.emitted.join('')).toContain('Math.floor(');
  });
});
