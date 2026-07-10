import { describe, test, expect } from 'bun:test';
import {
  createCursor, nextToken, peekToken, pushToken,
  skip, expect as expectToken,
  skipValue, skipSymbol,
  advanceAfterBlockEnd, advanceAfterVariableEnd,
} from './cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END, TOKEN_VARIABLE_END } from '../lexer/token-types.js';

const makeToken = (type, value, lineno = 1, colno = 1) => ({ type, value, lineno, colno });

describe('createCursor', () => {
  test('creates cursor with tokens and defaults', () => {
    const tokens = { nextToken: () => {} };
    const ctx = createCursor(tokens);
    expect(ctx.tokens).toBe(tokens);
    expect(ctx.peeked).toBeNull();
    expect(ctx.breakOnBlocks).toBeNull();
    expect(ctx.dropLeadingWhitespace).toBe(false);
  });
});

describe('nextToken', () => {
  test('returns next token from tokenizer', () => {
    const tokens = { nextToken: () => makeToken('symbol', 'foo') };
    const ctx = createCursor(tokens);
    expect(nextToken(ctx)).toEqual(makeToken('symbol', 'foo'));
  });

  test('returns peeked token if available', () => {
    const tokens = { nextToken: () => makeToken('symbol', 'unexpected') };
    const ctx = createCursor(tokens);
    ctx.peeked = makeToken('symbol', 'peeked');
    expect(nextToken(ctx)).toEqual(makeToken('symbol', 'peeked'));
    expect(ctx.peeked).toBeNull();
  });

  test('skips whitespace tokens when withWhitespace is false', () => {
    const calls = [
      makeToken('whitespace', ' '),
      makeToken('symbol', 'after'),
    ];
    let i = 0;
    const tokens = { nextToken: () => calls[i++] };
    const ctx = createCursor(tokens);
    expect(nextToken(ctx)).toEqual(makeToken('symbol', 'after'));
  });

  test('returns whitespace when withWhitespace is true', () => {
    const tokens = { nextToken: () => makeToken('whitespace', ' ') };
    const ctx = createCursor(tokens);
    expect(nextToken(ctx, true)).toEqual(makeToken('whitespace', ' '));
  });
});

describe('peekToken', () => {
  test('returns next token without consuming it', () => {
    const tokens = { nextToken: () => makeToken('symbol', 'peeked') };
    const ctx = createCursor(tokens);
    expect(peekToken(ctx)).toEqual(makeToken('symbol', 'peeked'));
    expect(peekToken(ctx)).toEqual(makeToken('symbol', 'peeked'));
    expect(ctx.peeked).toEqual(makeToken('symbol', 'peeked'));
  });
});

describe('pushToken', () => {
  test('pushes token back onto the cursor', () => {
    const ctx = createCursor({ nextToken: () => makeToken('symbol', 'should not be used') });
    pushToken(ctx, makeToken('symbol', 'pushed'));
    expect(nextToken(ctx)).toEqual(makeToken('symbol', 'pushed'));
  });

  test('throws if already has a peeked token', () => {
    const ctx = createCursor({ nextToken: () => {} });
    ctx.peeked = makeToken('symbol', 'existing');
    expect(() => pushToken(ctx, makeToken('symbol', 'another'))).toThrow('can only push one token');
  });
});

describe('skip', () => {
  test('returns true and consumes token if type matches', () => {
    const tokens = { nextToken: () => makeToken('comma', ',') };
    const ctx = createCursor(tokens);
    expect(skip(ctx, 'comma')).toBe(true);
  });

  test('returns false and pushes back if type does not match', () => {
    const tokens = { nextToken: () => makeToken('symbol', 'x') };
    const ctx = createCursor(tokens);
    expect(skip(ctx, 'comma')).toBe(false);
    expect(ctx.peeked).toEqual(makeToken('symbol', 'x'));
  });
});

describe('expect', () => {
  test('returns token if type matches', () => {
    const tokens = { nextToken: () => makeToken('block-end', '%}') };
    const ctx = createCursor(tokens);
    expect(expectToken(ctx, 'block-end')).toEqual(makeToken('block-end', '%}'));
  });

  test('fails if type does not match', () => {
    const tokens = { nextToken: () => makeToken('symbol', 'x') };
    const ctx = createCursor(tokens);
    expect(() => expectToken(ctx, 'block-end')).toThrow('expected block-end');
  });
});

describe('skipValue', () => {
  test('returns true if type and value match', () => {
    const tokens = { nextToken: () => makeToken(TOKEN_SYMBOL, 'endfor') };
    const ctx = createCursor(tokens);
    expect(skipValue(ctx, TOKEN_SYMBOL, 'endfor')).toBe(true);
  });

  test('returns false and pushes back if value does not match', () => {
    const tokens = { nextToken: () => makeToken(TOKEN_SYMBOL, 'endif') };
    const ctx = createCursor(tokens);
    expect(skipValue(ctx, TOKEN_SYMBOL, 'endfor')).toBe(false);
    expect(ctx.peeked.value).toBe('endif');
  });
});

describe('skipSymbol', () => {
  test('delegates to skipValue with TOKEN_SYMBOL', () => {
    const tokens = { nextToken: () => makeToken(TOKEN_SYMBOL, 'endblock') };
    const ctx = createCursor(tokens);
    expect(skipSymbol(ctx, 'endblock')).toBe(true);
  });

  test('returns false for mismatched symbol', () => {
    const tokens = { nextToken: () => makeToken(TOKEN_SYMBOL, 'other') };
    const ctx = createCursor(tokens);
    expect(skipSymbol(ctx, 'endblock')).toBe(false);
  });
});

describe('advanceAfterBlockEnd', () => {
  test('consumes block end token', () => {
    const tokens = {
      nextToken: () => makeToken(TOKEN_BLOCK_END, '%}'),
    };
    const ctx = createCursor(tokens);
    const result = advanceAfterBlockEnd(ctx, 'block');
    expect(result).toEqual(makeToken(TOKEN_BLOCK_END, '%}'));
  });

  test('sets dropLeadingWhitespace for trimmed end', () => {
    const tokens = {
      nextToken: () => makeToken(TOKEN_BLOCK_END, '-%}'),
    };
    const ctx = createCursor(tokens);
    advanceAfterBlockEnd(ctx, 'block');
    expect(ctx.dropLeadingWhitespace).toBe(true);
  });

  test('fails on non-block-end token when no name given', () => {
    const tokens = { nextToken: () => makeToken('symbol', 'x') };
    const ctx = createCursor(tokens);
    expect(() => advanceAfterBlockEnd(ctx)).toThrow();
  });

  test('fails on non-block-end token with name', () => {
    const tokens = { nextToken: () => makeToken('symbol', 'x') };
    const ctx = createCursor(tokens);
    expect(() => advanceAfterBlockEnd(ctx, 'myblock')).toThrow('expected block end');
  });
});

describe('advanceAfterVariableEnd', () => {
  test('consumes variable end token', () => {
    const tokens = {
      tags: { VARIABLE_END: '}}' },
      nextToken: () => makeToken(TOKEN_VARIABLE_END, '}}'),
    };
    const ctx = createCursor(tokens);
    expect(() => advanceAfterVariableEnd(ctx)).not.toThrow();
  });

  test('fails on non-variable-end token', () => {
    const tokens = {
      tags: { VARIABLE_END: '}}' },
      nextToken: () => makeToken('symbol', 'x'),
    };
    const ctx = createCursor(tokens);
    expect(() => advanceAfterVariableEnd(ctx)).toThrow('expected variable end');
  });
});
