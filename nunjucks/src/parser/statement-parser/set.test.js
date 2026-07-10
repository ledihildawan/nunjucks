import { describe, test, expect } from 'bun:test';
import { parseSet } from './set.js';
import { Set as AstSet, Capture, AstSymbol, Literal } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import {
  TOKEN_SYMBOL, TOKEN_BLOCK_END, TOKEN_COMMA, TOKEN_OPERATOR, TOKEN_INT,
} from '../../lexer/token-types.js';

describe('parseSet', () => {
  test('parses set with = operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'set', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 5 },
      { type: TOKEN_OPERATOR, value: '=', lineno: 1, colno: 7 },
      { type: TOKEN_INT, value: '42', lineno: 1, colno: 9 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 12 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const target = new AstSymbol(1, 5, 'x');
    const value = new Literal(1, 9, 42);
    const ctx = Object.assign(createCursor(tokens), {
      nextToken: () => nextToken(ctx),
      parsePrimary: () => { nextToken(ctx); return target; },
      parseExpression: () => { nextToken(ctx); return value; },
    });

    const result = parseSet(ctx);

    expect(result).toBeInstanceOf(AstSet);
    expect(result.targets).toEqual([target]);
    expect(result.value).toBe(value);
    expect(result.operator).toBeNull();
  });

  test('parses set with ||= operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'set', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 5 },
      { type: TOKEN_OPERATOR, value: '||=', lineno: 1, colno: 7 },
      { type: TOKEN_INT, value: '42', lineno: 1, colno: 11 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 14 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const target = new AstSymbol(1, 5, 'x');
    const value = new Literal(1, 11, 42);
    const ctx = Object.assign(createCursor(tokens), {
      nextToken: () => nextToken(ctx),
      parsePrimary: () => { nextToken(ctx); return target; },
      parseExpression: () => { nextToken(ctx); return value; },
    });

    const result = parseSet(ctx);

    expect(result).toBeInstanceOf(AstSet);
    expect(result.operator).toBe('||=');
    expect(result.value).toBe(value);
  });

  test('parses set with &&= operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'set', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 5 },
      { type: TOKEN_OPERATOR, value: '&&=', lineno: 1, colno: 7 },
      { type: TOKEN_INT, value: '42', lineno: 1, colno: 11 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 14 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const target = new AstSymbol(1, 5, 'x');
    const value = new Literal(1, 11, 42);
    const ctx = Object.assign(createCursor(tokens), {
      nextToken: () => nextToken(ctx),
      parsePrimary: () => { nextToken(ctx); return target; },
      parseExpression: () => { nextToken(ctx); return value; },
    });

    const result = parseSet(ctx);

    expect(result).toBeInstanceOf(AstSet);
    expect(result.operator).toBe('&&=');
  });

  test('parses set with ??= operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'set', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 5 },
      { type: TOKEN_OPERATOR, value: '??=', lineno: 1, colno: 7 },
      { type: TOKEN_INT, value: '42', lineno: 1, colno: 11 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 14 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const target = new AstSymbol(1, 5, 'x');
    const value = new Literal(1, 11, 42);
    const ctx = Object.assign(createCursor(tokens), {
      nextToken: () => nextToken(ctx),
      parsePrimary: () => { nextToken(ctx); return target; },
      parseExpression: () => { nextToken(ctx); return value; },
    });

    const result = parseSet(ctx);

    expect(result).toBeInstanceOf(AstSet);
    expect(result.operator).toBe('??=');
  });

  test('parses set with block body via capture', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'set', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 5 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 7 },
      { type: TOKEN_SYMBOL, value: 'endset', lineno: 1, colno: 13 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 20 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const target = new AstSymbol(1, 5, 'x');
    const body = { lineno: 1, colno: 10 };
    const ctx = Object.assign(createCursor(tokens), {
      nextToken: () => nextToken(ctx),
      parsePrimary: () => { nextToken(ctx); return target; },
      parseUntilBlocks: () => body,
    });

    const result = parseSet(ctx);

    expect(result).toBeInstanceOf(AstSet);
    expect(result.targets).toEqual([target]);
    expect(result.body).toBeInstanceOf(Capture);
    expect(result.body.body).toBe(body);
    expect(result.value).toBeNull();
    expect(result.operator).toBeNull();
  });

  test('parses set with target list', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'set', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 5 },
      { type: TOKEN_COMMA, lineno: 1, colno: 6 },
      { type: TOKEN_SYMBOL, value: 'y', lineno: 1, colno: 8 },
      { type: TOKEN_OPERATOR, value: '=', lineno: 1, colno: 10 },
      { type: TOKEN_INT, value: '42', lineno: 1, colno: 12 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 15 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const targets = [new AstSymbol(1, 5, 'x'), new AstSymbol(1, 8, 'y')];
    let primCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      nextToken: () => nextToken(ctx),
      parsePrimary: () => {
        const v = targets[primCalls];
        primCalls++;
        nextToken(ctx);
        return v;
      },
      parseExpression: () => { nextToken(ctx); return new Literal(1, 12, 42); },
    });

    const result = parseSet(ctx);

    expect(result).toBeInstanceOf(AstSet);
    expect(result.targets).toEqual(targets);
  });

  test('fails if not set keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'if', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(() => parseSet(ctx)).toThrow('parseSet: expected set');
  });
});
