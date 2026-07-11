import { describe, test, expect } from 'bun:test';
import { parseIf } from './if.js';
import { If, AstSymbol } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END } from '../../lexer/token-types.js';

describe('parseIf', () => {
  test('parses if with cond and body and endif', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'if', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'cond', lineno: 1, colno: 4 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 9 },
      { type: TOKEN_SYMBOL, value: 'endif', lineno: 1, colno: 15 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 21 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const cond = new AstSymbol(1, 4, 'x');
    const body = { lineno: 1, colno: 12 };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { nextToken(ctx); return cond; },
      parseUntilBlocks: () => body,
    });

    const result = parseIf(ctx);

    expect(result).toBeInstanceOf(If);
    expect(result.cond).toBe(cond);
    expect(result.body).toBe(body);
    expect(result.else_).toBeNull();
  });

  test('parses if with else', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'if', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'cond', lineno: 1, colno: 4 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 9 },
      { type: TOKEN_SYMBOL, value: 'else', lineno: 1, colno: 15 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 20 },
      { type: TOKEN_SYMBOL, value: 'endif', lineno: 1, colno: 26 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 32 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const cond = new AstSymbol(1, 4, 'x');
    const body = { lineno: 1, colno: 12 };
    const elseBody = { lineno: 1, colno: 24 };
    let blocksCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { nextToken(ctx); return cond; },
      parseUntilBlocks: (...args) => {
        blocksCalls++;
        return blocksCalls === 1 ? body : elseBody;
      },
    });

    const result = parseIf(ctx);

    expect(result).toBeInstanceOf(If);
    expect(result.cond).toBe(cond);
    expect(result.body).toBe(body);
    expect(result.else_).toBe(elseBody);
  });

  test('parses if with elif chain', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'if', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'cond1', lineno: 1, colno: 4 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 10 },
      { type: TOKEN_SYMBOL, value: 'elif', lineno: 1, colno: 16 },
      { type: TOKEN_SYMBOL, value: 'cond2', lineno: 1, colno: 21 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 27 },
      { type: TOKEN_SYMBOL, value: 'endif', lineno: 1, colno: 33 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 39 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const cond1 = new AstSymbol(1, 4, 'x');
    const cond2 = new AstSymbol(1, 21, 'y');
    let exprCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        exprCalls++;
        const v = exprCalls === 1 ? cond1 : cond2;
        nextToken(ctx);
        return v;
      },
      parseUntilBlocks: () => ({ lineno: 1, colno: 30 }),
    });

    const result = parseIf(ctx);

    expect(result).toBeInstanceOf(If);
    expect(result.cond).toBe(cond1);
    expect(result.else_).toBeInstanceOf(If);
    expect(result.else_.cond).toBe(cond2);
    expect(result.else_.else_).toBeNull();
  });

  test('parses elseif as elif', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'if', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'cond1', lineno: 1, colno: 4 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 10 },
      { type: TOKEN_SYMBOL, value: 'elseif', lineno: 1, colno: 16 },
      { type: TOKEN_SYMBOL, value: 'cond2', lineno: 1, colno: 23 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 29 },
      { type: TOKEN_SYMBOL, value: 'endif', lineno: 1, colno: 35 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 41 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const cond1 = new AstSymbol(1, 4, 'x');
    const cond2 = new AstSymbol(1, 23, 'y');
    let exprCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        exprCalls++;
        const v = exprCalls === 1 ? cond1 : cond2;
        nextToken(ctx);
        return v;
      },
      parseUntilBlocks: () => ({ lineno: 1, colno: 32 }),
    });

    const result = parseIf(ctx);

    expect(result).toBeInstanceOf(If);
    expect(result.else_).toBeInstanceOf(If);
    expect(result.else_.cond).toBe(cond2);
  });

  test('fails on unknown keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'for', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(() => parseIf(ctx)).toThrow('parseIf: expected if, elif, or elseif');
  });
});
