import { describe, test, expect } from 'bun:test';
import { createState } from './state.ts';
import { firstMatch } from './combinators.ts';
import { tokenizeWhitespace } from './tokenizers/whitespace.ts';
import { tokenizeNumber } from './tokenizers/number.ts';
import { tokenizeSymbol } from './tokenizers/symbol.ts';

const match = firstMatch(tokenizeWhitespace, tokenizeNumber, tokenizeSymbol);

describe('firstMatch', () => {
  test('returns first non-null result', () => {
    const r = match({ ...createState('42'), inCode: true });
    expect(r?.token.value).toBe(42);
  });

  test('short-circuits on first match', () => {
    const r = match({ ...createState('  '), inCode: true });
    expect(r?.token.type).toBe('whitespace');
  });

  test('returns null when all fail', () => {
    expect(match({ ...createState('('), inCode: true })).toBeNull();
  });

  test('empty argument list returns null', () => {
    expect(firstMatch()({ ...createState('x'), inCode: true })).toBeNull();
  });

  test('order dependence: symbol matches when number would not', () => {
    const r = match({ ...createState('abc'), inCode: true });
    expect(r?.token.type).toBe('symbol');
  });
});
