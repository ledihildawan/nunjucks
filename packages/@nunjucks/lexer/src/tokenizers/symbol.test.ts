import { describe, expect, test } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeSymbol } from './symbol.ts';

const run = (src: string) => tokenizeSymbol({ ...createState(src), inCode: true });

describe('tokenizeSymbol', () => {
  test('returns null for delimiter', () => {
    expect(run('(')).toBeNull();
  });

  test('plain identifier', () => {
    const r = run('myVar');
    expect(r?.token.type).toBe('symbol');
    expect(r?.token.value).toBe('myVar');
  });

  test('true → boolean', () => {
    expect(run('true')?.token.type).toBe('boolean');
  });

  test('false → boolean', () => {
    expect(run('false')?.token.type).toBe('boolean');
  });

  test('none → none', () => {
    expect(run('none')?.token.type).toBe('none');
  });

  test('null → none', () => {
    expect(run('null')?.token.type).toBe('none');
  });

  test('stops at delimiter', () => {
    const r = run('foo.bar');
    expect(r?.token.value).toBe('foo');
    expect(r?.state.index).toBe(3);
  });

  test('stops at operator', () => {
    const r = run('x+1');
    expect(r?.token.value).toBe('x');
  });
});
