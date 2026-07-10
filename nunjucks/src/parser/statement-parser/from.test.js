import { describe, test, expect } from 'bun:test';
import { parseFrom } from './from.js';
import { FromImport, AstSymbol, Pair } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import {
  TOKEN_SYMBOL, TOKEN_BLOCK_END, TOKEN_COMMA,
} from '../../lexer/token-types.js';

describe('parseFrom', () => {
  test('parses from import with multiple names', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'from', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'macros', lineno: 1, colno: 6 },
      { type: TOKEN_SYMBOL, value: 'import', lineno: 1, colno: 13 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 20 },
      { type: TOKEN_COMMA, value: ',', lineno: 1, colno: 21 },
      { type: TOKEN_SYMBOL, value: 'y', lineno: 1, colno: 23 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 25 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const names = [new AstSymbol(1, 20, 'x'), new AstSymbol(1, 23, 'y')];
    const template = new AstSymbol(1, 6, 'macros');
    let primCalls = 0;
    let exprCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        const v = names[primCalls];
        primCalls++;
        nextToken(ctx);
        return v;
      },
      parseExpression: () => {
        exprCalls++;
        nextToken(ctx);
        return template;
      },
    });

    const result = parseFrom(ctx);

    expect(result).toBeInstanceOf(FromImport);
    expect(result.template).toBe(template);
    expect(result.names.children).toHaveLength(2);
    expect(result.names.children[0]).toBe(names[0]);
    expect(result.names.children[1]).toBe(names[1]);
    expect(result.withContext).toBeNull();
  });

  test('parses from import with alias', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'from', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'macros', lineno: 1, colno: 6 },
      { type: TOKEN_SYMBOL, value: 'import', lineno: 1, colno: 13 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 20 },
      { type: TOKEN_SYMBOL, value: 'as', lineno: 1, colno: 22 },
      { type: TOKEN_SYMBOL, value: 'alias_x', lineno: 1, colno: 25 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 33 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const name = new AstSymbol(1, 20, 'x');
    const alias = new AstSymbol(1, 25, 'alias_x');
    const template = new AstSymbol(1, 6, 'macros');
    let primCalls = 0;
    let exprCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        primCalls++;
        if (primCalls === 1) { nextToken(ctx); return name; }
        nextToken(ctx); return alias;
      },
      parseExpression: () => {
        exprCalls++;
        nextToken(ctx);
        return template;
      },
    });

    const result = parseFrom(ctx);

    expect(result).toBeInstanceOf(FromImport);
    expect(result.names.children).toHaveLength(1);
    expect(result.names.children[0]).toBeInstanceOf(Pair);
    expect(result.names.children[0].key).toBe(name);
    expect(result.names.children[0].value).toBe(alias);
  });

  test('parses from import with with context', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'from', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'macros', lineno: 1, colno: 6 },
      { type: TOKEN_SYMBOL, value: 'import', lineno: 1, colno: 13 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 20 },
      { type: TOKEN_SYMBOL, value: 'with', lineno: 1, colno: 22 },
      { type: TOKEN_SYMBOL, value: 'context', lineno: 1, colno: 27 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 35 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const name = new AstSymbol(1, 20, 'x');
    const template = new AstSymbol(1, 6, 'macros');
    let primCalls = 0;
    let exprCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        primCalls++;
        nextToken(ctx);
        return name;
      },
      parseExpression: () => {
        exprCalls++;
        nextToken(ctx);
        return template;
      },
    });

    const result = parseFrom(ctx);

    expect(result).toBeInstanceOf(FromImport);
    expect(result.withContext).toBe(true);
  });

  test('parses from import with without context', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'from', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'macros', lineno: 1, colno: 6 },
      { type: TOKEN_SYMBOL, value: 'import', lineno: 1, colno: 13 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 20 },
      { type: TOKEN_SYMBOL, value: 'without', lineno: 1, colno: 22 },
      { type: TOKEN_SYMBOL, value: 'context', lineno: 1, colno: 30 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 38 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const name = new AstSymbol(1, 20, 'x');
    const template = new AstSymbol(1, 6, 'macros');
    let primCalls = 0;
    let exprCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        primCalls++;
        nextToken(ctx);
        return name;
      },
      parseExpression: () => {
        exprCalls++;
        nextToken(ctx);
        return template;
      },
    });

    const result = parseFrom(ctx);

    expect(result).toBeInstanceOf(FromImport);
    expect(result.withContext).toBe(false);
  });

  test('fails if no from keyword', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'import', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);

    expect(() => parseFrom(ctx)).toThrow('parseFrom: expected from');
  });

  test('fails if no import keyword', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'from', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'macros', lineno: 1, colno: 6 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 13 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const template = new AstSymbol(1, 6, 'macros');
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { nextToken(ctx); return template; },
    });

    expect(() => parseFrom(ctx)).toThrow('parseFrom: expected import');
  });

  test('fails with underscore name', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'from', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'macros', lineno: 1, colno: 6 },
      { type: TOKEN_SYMBOL, value: 'import', lineno: 1, colno: 13 },
      { type: TOKEN_SYMBOL, value: '_private', lineno: 1, colno: 20 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 29 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const name = new AstSymbol(1, 20, '_private');
    const template = new AstSymbol(1, 6, 'macros');
    let exprCalls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { nextToken(ctx); return name; },
      parseExpression: () => { exprCalls++; nextToken(ctx); return template; },
    });

    expect(() => parseFrom(ctx)).toThrow('names starting with an underscore');
  });

  test('fails with no names', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'from', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'macros', lineno: 1, colno: 6 },
      { type: TOKEN_SYMBOL, value: 'import', lineno: 1, colno: 13 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 20 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const template = new AstSymbol(1, 6, 'macros');
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { nextToken(ctx); return template; },
    });

    expect(() => parseFrom(ctx)).toThrow('Expected at least one import name');
  });
});
