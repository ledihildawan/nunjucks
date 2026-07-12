import { describe, test, expect } from 'bun:test';
import { parsePostfix } from './index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_LEFT_PAREN, TOKEN_LEFT_BRACKET, TOKEN_OPERATOR, TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parsePostfix', () => {
  test('returns node unchanged when no postfix tokens', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'end', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens));
    const node = { lineno: 1, colno: 1 };

    const result = parsePostfix(ctx, node);

    expect(result).toBe(node);
  });

  test('calls parseFunCall on LEFT_PAREN', () => {
    const seq = [
      { type: TOKEN_LEFT_PAREN, value: '(', lineno: 1, colno: 5 },
      { type: 'right-paren', value: ')', lineno: 1, colno: 6 },
      { type: TOKEN_SYMBOL, value: 'end', lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parseSignature: () => {
        nextToken(ctx);
        nextToken(ctx);
        return [];
      },
    });
    const node = { lineno: 1, colno: 1 };

    const result = parsePostfix(ctx, node);

    expect(result).not.toBe(node);
  });

  test('calls parseBracketAccess on LEFT_BRACKET', () => {
    const seq = [
      { type: TOKEN_LEFT_BRACKET, value: '[', lineno: 1, colno: 5 },
      { type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 6 },
      { type: 'right-bracket', value: ']', lineno: 1, colno: 7 },
      { type: TOKEN_SYMBOL, value: 'end', lineno: 1, colno: 8 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        nextToken(ctx);
        return { lineno: 1, colno: 6 };
      },
    });
    const node = { lineno: 1, colno: 1 };

    const result = parsePostfix(ctx, node);

    expect(result).not.toBe(node);
  });

  test('calls parseDotAccess on OPERATOR .', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '.', lineno: 1, colno: 5 },
      { type: TOKEN_SYMBOL, value: 'bar', lineno: 1, colno: 6 },
      { type: TOKEN_SYMBOL, value: 'end', lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens));
    const node = { lineno: 1, colno: 1 };

    const result = parsePostfix(ctx, node);

    expect(result).not.toBe(node);
  });

  test('calls parseOptionalChain on OPERATOR ?.', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '?.', lineno: 1, colno: 5 },
      { type: TOKEN_SYMBOL, value: 'bar', lineno: 1, colno: 7 },
      { type: TOKEN_SYMBOL, value: 'end', lineno: 1, colno: 8 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens));
    const node = { lineno: 1, colno: 1 };

    const result = parsePostfix(ctx, node);

    expect(result).not.toBe(node);
  });

  test('chains multiple postfix operations', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '.', lineno: 1, colno: 3 },
      { type: TOKEN_SYMBOL, value: 'bar', lineno: 1, colno: 4 },
      { type: TOKEN_LEFT_PAREN, value: '(', lineno: 1, colno: 8 },
      { type: 'right-paren', value: ')', lineno: 1, colno: 9 },
      { type: TOKEN_SYMBOL, value: 'end', lineno: 1, colno: 10 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = Object.assign(createCursor(tokens), {
      parseSignature: () => {
        nextToken(ctx);
        nextToken(ctx);
        return [];
      },
    });
    const node = { lineno: 1, colno: 1 };

    const result = parsePostfix(ctx, node);

    expect(result).not.toBe(node);
  });
});
