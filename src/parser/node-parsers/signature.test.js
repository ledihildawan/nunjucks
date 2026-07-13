import { describe, test, expect } from 'bun:test';
import { parseSignature } from './signature.js';
import { nodes } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import {
  TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN,
  TOKEN_COMMA, TOKEN_OPERATOR,
  TOKEN_SYMBOL, TOKEN_BLOCK_END,
} from '../../lexer/token-types.js';

describe('parseSignature', () => {
  test('parses empty signature with parens', () => {
    const seq = [
      { type: TOKEN_LEFT_PAREN, lineno: 1, colno: 1 },
      { type: TOKEN_RIGHT_PAREN, lineno: 1, colno: 2 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens));

    const result = parseSignature(ctx);

    expect(nodes.isNodeList(result)).toBe(true);
    expect(result.children).toEqual([]);
  });

  test('parses signature with positional args', () => {
    const seq = [
      { type: TOKEN_LEFT_PAREN, lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'a', lineno: 1, colno: 2 },
      { type: TOKEN_COMMA, lineno: 1, colno: 4 },
      { type: TOKEN_SYMBOL, value: 'b', lineno: 1, colno: 5 },
      { type: TOKEN_RIGHT_PAREN, lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const args = [nodes.symbol(1, 2, 'a'), nodes.symbol(1, 5, 'b')];
    let i = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { const v = args[i++]; nextToken(ctx); return v; },
    });

    const result = parseSignature(ctx);

    expect(nodes.isNodeList(result)).toBe(true);
    expect(result.children).toEqual(args);
  });

  test('parses signature with keyword args', () => {
    const seq = [
      { type: TOKEN_LEFT_PAREN, lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'name', lineno: 1, colno: 2 },
      { type: TOKEN_OPERATOR, value: '=', lineno: 1, colno: 7 },
      { type: TOKEN_SYMBOL, value: 'test', lineno: 1, colno: 9 },
      { type: TOKEN_RIGHT_PAREN, lineno: 1, colno: 14 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const name = nodes.symbol(1, 2, 'name');
    const value = nodes.literal(1, 9, 'test');
    let call = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        call++;
        const v = call === 1 ? name : value;
        nextToken(ctx);
        return v;
      },
    });

    const result = parseSignature(ctx);

    expect(nodes.isNodeList(result)).toBe(true);
    const kw = result.children[0];
    expect(nodes.getNodeTypeName(kw)).toBe('keywordArgs');
    expect(nodes.getNodeTypeName(kw.children[0])).toBe('pair');
    expect(kw.children[0].key).toBe(name);
    expect(kw.children[0].value).toBe(value);
  });

  test('returns null in tolerant mode without paren', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(parseSignature(ctx, true)).toBeNull();
  });

  test('fails without paren in non-tolerant mode', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const ctx = createCursor(tokens);

    expect(() => parseSignature(ctx)).toThrow('expected arguments');
  });

  test('parses signature with noParens mode', () => {
    const seq = [
      { type: TOKEN_BLOCK_END, lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);

    const result = parseSignature(ctx, false, true);

    expect(nodes.isNodeList(result)).toBe(true);
    expect(result.children).toEqual([]);
  });

  test('fails on missing comma', () => {
    const seq = [
      { type: TOKEN_LEFT_PAREN, lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'a', lineno: 1, colno: 2 },
      { type: TOKEN_SYMBOL, value: 'b', lineno: 1, colno: 4 },
      { type: TOKEN_RIGHT_PAREN, lineno: 1, colno: 6 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => { nextToken(ctx); return nodes.symbol(1, 2, 'a'); },
    });

    expect(() => parseSignature(ctx)).toThrow('parseSignature: expected comma after expression');
  });
});
