import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from './index.ts';
import { nextTokenOrNull, peekTokenOrNull, skip, expect as expectToken, skipValue, skipSymbol, consumeWhitespaceDrop, nextToken } from './cursor.ts';
import type { ParserContext, TokenStream } from './cursor.ts';

const makeCtx = (src: string): ParserContext => {
  const tk = createTokenizer(src);
  return {
    tokens: tk as unknown as TokenStream,
    peeked: null,
    dropLeadingWhitespace: false,
    extensions: [],
  };
};

describe('cursor: token navigation', () => {
  test('nextTokenOrNull returns tokens then null at EOF', () => {
    const ctx = makeCtx('{{ x }}');
    const t1 = nextTokenOrNull(ctx);
    expect(t1).toBeTruthy();
    while (nextTokenOrNull(ctx)) { /* consume */ }
    expect(nextTokenOrNull(ctx)).toBeNull();
  });

  test('peekTokenOrNull looks ahead without consuming', () => {
    const ctx = makeCtx('{{ x }}');
    const peeked = peekTokenOrNull(ctx);
    expect(peeked).toBeTruthy();
    const next = nextTokenOrNull(ctx);
    expect(next).toBe(peeked);
  });

  test('nextToken throws on EOF', () => {
    const ctx = makeCtx('');
    while (nextTokenOrNull(ctx)) { /* consume */ }
    expect(() => nextToken(ctx)).toThrow();
  });

  test('skip returns true for matching type', () => {
    const ctx = makeCtx('{{ x }}');
    nextTokenOrNull(ctx); // consume variable-start
    // next should be symbol 'x'
    const result = skip(ctx, 'symbol' as never);
    expect(result).toBe(true);
  });

  test('skipSymbol matches symbol value', () => {
    const ctx = makeCtx('{% if true %}');
    nextTokenOrNull(ctx); // block-start
    expect(skipSymbol(ctx, 'if')).toBe(true);
  });

  test('skipValue matches type and value', () => {
    const ctx = makeCtx('{{ x }}');
    nextTokenOrNull(ctx); // variable-start
    expect(skipValue(ctx, 'symbol' as never, 'x')).toBe(true);
    expect(skipValue(ctx, 'symbol' as never, 'y')).toBe(false);
  });

  test('expect throws on wrong type', () => {
    const ctx = makeCtx('{{ x }}');
    nextTokenOrNull(ctx); // variable-start
    expect(() => expectToken(ctx, 'block-end' as never)).toThrow();
  });
});

describe('cursor: whitespace drop', () => {
  test('consumeWhitespaceDrop reads and resets flag', () => {
    const ctx = makeCtx('x');
    ctx.dropLeadingWhitespace = true;
    const drop = consumeWhitespaceDrop(ctx);
    expect(drop).toBe(true);
    expect(ctx.dropLeadingWhitespace).toBe(false);
  });

  test('consumeWhitespaceDrop returns false when not set', () => {
    const ctx = makeCtx('x');
    expect(consumeWhitespaceDrop(ctx)).toBe(false);
  });
});

describe('cursor: ParserContext', () => {
  test('createParser returns minimal context', () => {
    const tk = createTokenizer('x');
    const ctx = createParser(tk as unknown as TokenStream);
    expect(ctx.peeked).toBeNull();
    expect(ctx.dropLeadingWhitespace).toBe(false);
    expect(ctx.extensions).toEqual([]);
  });
});
