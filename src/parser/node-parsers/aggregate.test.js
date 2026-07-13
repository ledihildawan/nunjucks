import { describe, test, expect } from 'bun:test';
import { parseAggregate } from './aggregate.js';
import { nodes } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import {
  TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN,
  TOKEN_LEFT_BRACKET, TOKEN_RIGHT_BRACKET,
  TOKEN_LEFT_CURLY, TOKEN_RIGHT_CURLY,
  TOKEN_COMMA, TOKEN_COLON,
  TOKEN_SYMBOL,
} from '../../lexer/token-types.js';

describe('parseAggregate', () => {
  test('parses empty group with parens', () => {
    const seq = [
      { type: TOKEN_LEFT_PAREN, lineno: 1, colno: 1 },
      { type: TOKEN_RIGHT_PAREN, lineno: 1, colno: 2 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);

    const result = parseAggregate(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('group');
    expect(result.children).toEqual([]);
  });

  test('parses group with expression', () => {
    const seq = [
      { type: TOKEN_LEFT_PAREN, lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 2 },
      { type: TOKEN_RIGHT_PAREN, lineno: 1, colno: 4 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const expr = nodes.symbol(1, 2, 'x');
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { nextToken(ctx); return expr; },
    });

    const result = parseAggregate(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('group');
    expect(result.children).toEqual([expr]);
  });

  test('parses group with comma-separated expressions', () => {
    const seq = [
      { type: TOKEN_LEFT_PAREN, lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'a', lineno: 1, colno: 2 },
      { type: TOKEN_COMMA, lineno: 1, colno: 4 },
      { type: TOKEN_SYMBOL, value: 'b', lineno: 1, colno: 5 },
      { type: TOKEN_RIGHT_PAREN, lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const exprs = [nodes.symbol(1, 2, 'a'), nodes.symbol(1, 5, 'b')];
    let i = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { const v = exprs[i++]; nextToken(ctx); return v; },
    });

    const result = parseAggregate(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('group');
    expect(result.children).toEqual(exprs);
  });

  test('parses empty array with brackets', () => {
    const seq = [
      { type: TOKEN_LEFT_BRACKET, lineno: 1, colno: 1 },
      { type: TOKEN_RIGHT_BRACKET, lineno: 1, colno: 2 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);

    const result = parseAggregate(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('array');
    expect(result.children).toEqual([]);
  });

  test('parses empty dict with curly braces', () => {
    const seq = [
      { type: TOKEN_LEFT_CURLY, lineno: 1, colno: 1 },
      { type: TOKEN_RIGHT_CURLY, lineno: 1, colno: 2 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);

    const result = parseAggregate(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('dict');
    expect(result.children).toEqual([]);
  });

  test('parses dict with key:value pairs', () => {
    const seq = [
      { type: TOKEN_LEFT_CURLY, lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'name', lineno: 1, colno: 2 },
      { type: TOKEN_COLON, lineno: 1, colno: 7 },
      { type: TOKEN_SYMBOL, value: 'test', lineno: 1, colno: 9 },
      { type: TOKEN_RIGHT_CURLY, lineno: 1, colno: 14 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const key = nodes.literal(1, 2, 'name');
    const value = nodes.literal(1, 9, 'test');
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { nextToken(ctx); return key; },
      parseExpression: () => { nextToken(ctx); return value; },
    });

    const result = parseAggregate(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('dict');
    expect(result.children.length).toBe(1);
    expect(nodes.getNodeTypeName(result.children[0])).toBe('pair');
    expect(result.children[0].key).toBe(key);
    expect(result.children[0].value).toBe(value);
  });

  test('returns null for unknown token type', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);

    expect(parseAggregate(ctx)).toBeNull();
  });

  test('fails on missing comma between expressions', () => {
    const seq = [
      { type: TOKEN_LEFT_PAREN, lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'a', lineno: 1, colno: 2 },
      { type: TOKEN_SYMBOL, value: 'b', lineno: 1, colno: 4 },
      { type: TOKEN_RIGHT_PAREN, lineno: 1, colno: 6 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    let i = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { const v = nodes.symbol(1, i === 0 ? 2 : 5, i === 0 ? 'a' : 'b'); i++; nextToken(ctx); return v; },
    });

    expect(() => parseAggregate(ctx)).toThrow('parseAggregate: expected comma after expression');
  });

  test('fails on missing colon in dict', () => {
    const seq = [
      { type: TOKEN_LEFT_CURLY, lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'name', lineno: 1, colno: 2 },
      { type: TOKEN_RIGHT_CURLY, lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const key = nodes.literal(1, 2, 'name');
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { nextToken(ctx); return key; },
      parseExpression: () => key,
    });

    expect(() => parseAggregate(ctx)).toThrow('parseAggregate: expected colon after dict key');
  });
});
