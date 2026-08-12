import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from './index.ts';
import { nextTokenOrNull, peekTokenOrNull, skip, expect as expectToken, skipValue, skipSymbol, consumeWhitespaceDrop, nextToken } from './cursor.ts';
import type { ParserContext } from './cursor.ts';
import { asTokenStream } from './test-helpers.ts';
import { isErr } from '@nunjucks/lib';

const makeCtx = (src: string): ParserContext => {
  const tk = createTokenizer(src);
  return {
    tokens: asTokenStream(tk),
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
    while (nextTokenOrNull(ctx)) {  }
    expect(nextTokenOrNull(ctx)).toBeNull();
  });

  test('peekTokenOrNull looks ahead without consuming', () => {
    const ctx = makeCtx('{{ x }}');
    const peeked = peekTokenOrNull(ctx);
    expect(peeked).toBeTruthy();
    const next = nextTokenOrNull(ctx);
    expect(next).toBe(peeked);
  });

  test('nextToken returns Err on EOF', () => {
    const ctx = makeCtx('');
    while (nextTokenOrNull(ctx)) {  }
    expect(isErr(nextToken(ctx))).toBe(true);
  });

  test('skip returns true for matching type', () => {
    const ctx = makeCtx('{{ x }}');
    nextTokenOrNull(ctx); 
    const result = skip(ctx, 'symbol' as never);
    expect(result).toBe(true);
  });

  test('skipSymbol matches symbol value', () => {
    const ctx = makeCtx('{% if true %}');
    nextTokenOrNull(ctx); 
    expect(skipSymbol(ctx, 'if')).toBe(true);
  });

  test('skipValue matches type and value', () => {
    const ctx = makeCtx('{{ x }}');
    nextTokenOrNull(ctx); 
    expect(skipValue(ctx, 'symbol' as never, 'x')).toBe(true);
    expect(skipValue(ctx, 'symbol' as never, 'y')).toBe(false);
  });

  test('expect returns Err on wrong type', () => {
    const ctx = makeCtx('{{ x }}');
    nextTokenOrNull(ctx); 
    expect(isErr(expectToken(ctx, 'block-end' as never))).toBe(true);
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
    const ctx = createParser(asTokenStream(tk));
    expect(ctx.peeked).toBeNull();
    expect(ctx.dropLeadingWhitespace).toBe(false);
    expect(ctx.extensions).toEqual([]);
  });
});
