import { describe, test, expect } from 'bun:test';
import { parseFor } from './for.js';
import { For, AsyncEach, AsyncAll, AstSymbol, Array as ArrayNode } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END, TOKEN_COMMA } from '../../lexer/token-types.js';

describe('parseFor', () => {
  test('parses basic for loop', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'for', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'item', lineno: 1, colno: 5 },
      { type: TOKEN_SYMBOL, value: 'in', lineno: 1, colno: 10 },
      { type: TOKEN_SYMBOL, value: 'items', lineno: 1, colno: 13 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 19 },
      { type: TOKEN_SYMBOL, value: 'endfor', lineno: 1, colno: 25 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 32 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const arrExpr = { lineno: 1, colno: 15 };
    const body = { lineno: 1, colno: 22 };
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { nextToken(ctx); return AstSymbol(1, 5, 'item'); },
      parseExpression: () => { nextToken(ctx); return arrExpr; },
      parseUntilBlocks: () => body,
    });

    const result = parseFor(ctx);

    expect(result).toBeInstanceOf(For);
    expect(result.arr).toBe(arrExpr);
    expect(result.body).toBe(body);
    expect(result.else_).toBeNull();
  });

  test('parses for loop with comma-separated variables', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'for', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'key', lineno: 1, colno: 5 },
      { type: TOKEN_COMMA, lineno: 1, colno: 8 },
      { type: TOKEN_SYMBOL, value: 'value', lineno: 1, colno: 10 },
      { type: TOKEN_SYMBOL, value: 'in', lineno: 1, colno: 16 },
      { type: TOKEN_SYMBOL, value: 'items', lineno: 1, colno: 19 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 25 },
      { type: TOKEN_SYMBOL, value: 'endfor', lineno: 1, colno: 31 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 38 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const arrExpr = { lineno: 1, colno: 21 };
    const body = { lineno: 1, colno: 28 };
    let primCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        const v = primCalls === 0 ? AstSymbol(1, 5, 'key') : (primCalls === 1 ? AstSymbol(1, 10, 'value') : AstSymbol(1, 21, 'items'));
        primCalls++;
        nextToken(ctx);
        return v;
      },
      parseExpression: () => { nextToken(ctx); return arrExpr; },
      parseUntilBlocks: () => body,
    });

    const result = parseFor(ctx);

    expect(result).toBeInstanceOf(For);
    expect(result.name).toBeInstanceOf(ArrayNode);
    expect(result.name.children.length).toBe(2);
  });

  test('parses asyncEach loop', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'asyncEach', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'item', lineno: 1, colno: 11 },
      { type: TOKEN_SYMBOL, value: 'in', lineno: 1, colno: 16 },
      { type: TOKEN_SYMBOL, value: 'items', lineno: 1, colno: 19 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 25 },
      { type: TOKEN_SYMBOL, value: 'endeach', lineno: 1, colno: 31 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 39 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { nextToken(ctx); return AstSymbol(1, 11, 'item'); },
      parseExpression: () => { nextToken(ctx); return { lineno: 1, colno: 21 }; },
      parseUntilBlocks: () => ({ lineno: 1, colno: 28 }),
    });

    const result = parseFor(ctx);

    expect(result).toBeInstanceOf(AsyncEach);
  });

  test('parses asyncAll loop', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'asyncAll', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'item', lineno: 1, colno: 10 },
      { type: TOKEN_SYMBOL, value: 'in', lineno: 1, colno: 15 },
      { type: TOKEN_SYMBOL, value: 'items', lineno: 1, colno: 18 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 24 },
      { type: TOKEN_SYMBOL, value: 'endall', lineno: 1, colno: 30 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 37 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { nextToken(ctx); return AstSymbol(1, 10, 'item'); },
      parseExpression: () => { nextToken(ctx); return { lineno: 1, colno: 20 }; },
      parseUntilBlocks: () => ({ lineno: 1, colno: 27 }),
    });

    const result = parseFor(ctx);

    expect(result).toBeInstanceOf(AsyncAll);
  });

  test('parses for loop with else block', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'for', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'item', lineno: 1, colno: 5 },
      { type: TOKEN_SYMBOL, value: 'in', lineno: 1, colno: 10 },
      { type: TOKEN_SYMBOL, value: 'items', lineno: 1, colno: 13 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 19 },
      { type: TOKEN_SYMBOL, value: 'else', lineno: 1, colno: 25 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 27 },
      { type: TOKEN_SYMBOL, value: 'endfor', lineno: 1, colno: 33 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 40 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const body = { lineno: 1, colno: 22 };
    const elseBody = { lineno: 1, colno: 28 };
    let blocksCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { nextToken(ctx); return AstSymbol(1, 5, 'item'); },
      parseExpression: () => { nextToken(ctx); return { lineno: 1, colno: 15 }; },
      parseUntilBlocks: (...args) => {
        blocksCalls++;
        return blocksCalls === 1 ? body : elseBody;
      },
    });

    const result = parseFor(ctx);

    expect(result).toBeInstanceOf(For);
    expect(result.body).toBe(body);
    expect(result.else_).toBe(elseBody);
  });

  test('fails on unknown keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'if', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens));

    expect(() => parseFor(ctx)).toThrow('parseFor: expected for');
  });

  test('fails on missing in keyword', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'for', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'item', lineno: 1, colno: 5 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 10 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { nextToken(ctx); return AstSymbol(1, 5, 'item'); },
    });

    expect(() => parseFor(ctx)).toThrow('parseFor: expected "in" keyword for loop');
  });

  test('fails on non-symbol variable name', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'for', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => ({ lineno: 1, colno: 5, value: 5, typename: 'Literal' }),
    });

    expect(() => parseFor(ctx)).toThrow('parseFor: variable name expected for loop');
  });
});
