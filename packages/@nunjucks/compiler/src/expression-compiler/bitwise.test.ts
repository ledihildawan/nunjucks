import { describe, expect, test } from 'bun:test';
import type { BinaryNode } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { createFrame } from '@nunjucks/runtime/frame';
import type { Compiler } from '../create-compiler.ts';
import { asCompiler } from '../test-helpers.ts';
import {
  compileBitwiseAnd,
  compileBitwiseLShift,
  compileBitwiseNot,
  compileBitwiseOr,
  compileBitwiseRShift,
  compileBitwiseXor,
} from './bitwise.ts';

const makeCompiler = () => {
  const emitted: string[] = [];
  return {
    emitted,
    emit: (s: string) => {
      emitted.push(s);
    },
    compile: (node: { mock?: string }) => {
      emitted.push(node.mock as string);
    },
  };
};

const makeBinary = (l: string, r: string) => ({
  lineno: 5,
  colno: 9,
  left: { mock: l },
  right: { mock: r },
});

const makeUnary = (mock: string) => ({
  lineno: 6,
  colno: 3,
  target: { mock },
});

type BinaryBitwiseEmitter = (compiler: Compiler, input: { node: BinaryNode; frame: Frame }) => void;

const cases: Array<{ name: string; operator: string; emit: BinaryBitwiseEmitter }> = [
  { name: 'compileBitwiseOr', operator: '|', emit: compileBitwiseOr },
  { name: 'compileBitwiseAnd', operator: '&', emit: compileBitwiseAnd },
  { name: 'compileBitwiseXor', operator: '^', emit: compileBitwiseXor },
  { name: 'compileBitwiseLShift', operator: '<<', emit: compileBitwiseLShift },
  { name: 'compileBitwiseRShift', operator: '>>', emit: compileBitwiseRShift },
];

describe('binary bitwise emitters', () => {
  const frame = createFrame();
  for (const { name, operator, emit } of cases) {
    test(`${name} emits ' ${operator} ' between operands`, () => {
      const c = makeCompiler();
      emit(asCompiler(c), { node: makeBinary('L', 'R') as never, frame });
      expect(c.emitted.join('')).toBe(`(lineno = 5, colno = 9, L ${operator} R)`);
    });
  }

  test('compileBitwiseNot emits ~ before target', () => {
    const c = makeCompiler();
    compileBitwiseNot(asCompiler(c), { node: makeUnary('X') as never, frame });
    expect(c.emitted.join('')).toBe('(lineno = 6, colno = 3, ~X)');
  });
});
