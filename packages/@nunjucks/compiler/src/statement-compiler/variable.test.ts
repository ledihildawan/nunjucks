import { describe, test, expect } from 'bun:test';
import { compileVariableDeclaration, compileVariableAssignment, compileCompoundAssignment } from './variable.ts';
import { symbol, literal } from '@nunjucks/nodes';
import { asCompiler } from '../test-helpers.ts';
import { createFrame } from '@nunjucks/runtime/frame';
import { ZERO_LOC } from '@nunjucks/shared';
import { loc } from '@nunjucks/shared';

const frame = createFrame();

const makeCompiler = () => {
  const emitted: string[] = [];
  let id = 0;
  return {
    emitted,
    emit: (s: string) => { emitted.push(s); },
    emitLine: (s: string) => { emitted.push(`${s}\n`); },
    tmpid: () => { id += 1; return `t_${id}`; },
    compile: (n: { mock?: string }) => { emitted.push(n.mock ?? 'X'); },
    compileExpression: (n: { mock?: string }) => { emitted.push(n.mock ?? 'V'); },
    fail: (msg: string, ..._rest: unknown[]) => { throw new Error(msg); },
  };
};

const declNode = (name: string, valueMock: string) => ({
  targets: [symbol(ZERO_LOC, name)],
  value: { mock: valueMock },
});

describe('compileVariableDeclaration', () => {
  test('emits frame.set with the value', () => {
    const c = makeCompiler();
    compileVariableDeclaration(asCompiler(c), { node: declNode('x', 'V') as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('let t_1 =');
    expect(joined).toContain('V;');
    expect(joined).toContain('frame = frame.set({ name: "x", value: t_1, resolveUp: true });');
  });
});

describe('compileVariableAssignment', () => {
  test('emits a ReferenceError guard for undeclared variables', () => {
    const c = makeCompiler();
    compileVariableAssignment(asCompiler(c), { node: declNode('x', 'V') as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('ReferenceError');
    expect(joined).toContain('Use x := value to declare it');
    expect(joined).toContain('frame = frame.set({ name: "x"');
  });
});

describe('compileCompoundAssignment', () => {
  test("'+=' emits the plus operator and frame.set", () => {
    const c = makeCompiler();
    const node = {
      targets: [symbol(loc({ lineno: 1, colno: 2 }), 'count')],
      operator: '+=',
      value: literal(loc({ lineno: 1, colno: 2 }), 1),
      lineno: 1, colno: 2,
    };
    compileCompoundAssignment(asCompiler(c), { node: node as never, frame });
    const joined = c.emitted.join('');
    expect(joined).toContain('runtime.contextOrFrameLookup(context, frame, "count")');
    expect(joined).toContain('t_2 = t_1 +');
    expect(joined).toContain('frame = frame.set({ name: "count"');
  });

  test('//= emits Math.floor division', () => {
    const c = makeCompiler();
    const node = {
      targets: [symbol(loc({ lineno: 1, colno: 2 }), 'n')],
      operator: '//=',
      value: literal(loc({ lineno: 1, colno: 2 }), 2),
      lineno: 1, colno: 2,
    };
    compileCompoundAssignment(asCompiler(c), { node: node as never, frame });
    expect(c.emitted.join('')).toContain('Math.floor(');
  });
});