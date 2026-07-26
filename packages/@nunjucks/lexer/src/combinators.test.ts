import { describe, test, expect } from 'bun:test';
import { or } from './combinators.ts';
import { createState } from './state.ts';
import { createToken } from './tokens.ts';
import type { Tokenizer } from './types.ts';

const matchSymbol: Tokenizer = (state) => ({
  token: createToken('symbol', 'x', state.lineno, state.colno),
  state,
});

const matchInt: Tokenizer = (state) => ({
  token: createToken('int', 1, state.lineno, state.colno),
  state,
});

const never: Tokenizer = () => null;

describe('or combinator', () => {
  test('returns the first matching tokenizer result', () => {
    const combined = or(matchSymbol, never);
    const result = combined(createState('x'));
    expect(result).not.toBeNull();
    expect(result!.token.type).toBe('symbol');
  });

  test('returns null when no tokenizer matches', () => {
    const combined = or(never, never);
    expect(combined(createState('x'))).toBeNull();
  });

  test('falls through to later tokenizers', () => {
    const combined = or(never, matchInt);
    const result = combined(createState('1'));
    expect(result).not.toBeNull();
    expect(result!.token.type).toBe('int');
  });

  test('returns null when given no tokenizers', () => {
    const combined = or();
    expect(combined(createState('x'))).toBeNull();
  });

  test('does not invoke tokenizers after the first match', () => {
    let calls = 0;
    const counting: Tokenizer = (state) => {
      calls += 1;
      return matchSymbol(state);
    };
    const combined = or(counting, counting, counting);
    combined(createState('x'));
    expect(calls).toBe(1);
  });
});
