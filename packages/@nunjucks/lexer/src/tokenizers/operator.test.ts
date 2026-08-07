import { describe, test, expect } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeOperator } from './operator.ts';

const run = (src: string) => tokenizeOperator({ ...createState(src), inCode: true });

describe('tokenizeOperator', () => {
  test('returns null for non-delimiter', () => {
    expect(run('abc')).toBeNull();
  });

  test('plus', () => {
    expect(run('+')?.token.type).toBe('operator');
  });

  test('left paren', () => {
    expect(run('(')?.token.type).toBe('left-paren');
  });

  test('right bracket', () => {
    expect(run(']')?.token.type).toBe('right-bracket');
  });

  test('comma', () => {
    expect(run(',')?.token.type).toBe('comma');
  });

  test('pipe-forward', () => {
    const r = run('|>');
    expect(r?.token.type).toBe('pipe-forward');
  });

  test('spread', () => {
    const r = run('...');
    expect(r?.token.type).toBe('spread');
  });

  test('=== longest match', () => {
    const r = run('===');
    expect(r?.token.value).toBe('===');
    expect(r?.state.index).toBe(3);
  });

  test('**= longest match', () => {
    const r = run('**=');
    expect(r?.state.index).toBe(3);
  });

  test('.. range operator', () => {
    const r = run('..');
    expect(r?.state.index).toBe(2);
  });
});
