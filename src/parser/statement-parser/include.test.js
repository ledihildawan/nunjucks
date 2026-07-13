import { describe, test, expect } from 'bun:test';
import { parseInclude } from './include.js';
import { nodes } from '../../nodes/index.js';
import { createCursor, nextToken } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_BLOCK_END } from '../../lexer/token-types.js';

describe('parseInclude', () => {
  test('parses include statement', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'include', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'other', lineno: 1, colno: 9 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 15 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const templateNode = { lineno: 1, colno: 9 };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        nextToken(ctx);
        return templateNode;
      },
    });

    const result = parseInclude(ctx);

    expect(nodes.isInclude(result)).toBe(true);
    expect(result.template).toBe(templateNode);
    expect(result.ignoreMissing).toBeNull();
  });

  test('parses include with ignore missing', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'include', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'other', lineno: 1, colno: 9 },
      { type: TOKEN_SYMBOL, value: 'ignore', lineno: 1, colno: 15 },
      { type: TOKEN_SYMBOL, value: 'missing', lineno: 1, colno: 22 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 30 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const templateNode = { lineno: 1, colno: 9 };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        nextToken(ctx);
        return templateNode;
      },
    });

    const result = parseInclude(ctx);

    expect(nodes.isInclude(result)).toBe(true);
    expect(result.ignoreMissing).toBe(true);
  });

  test('fails if not include keyword', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'block', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens));

    expect(() => parseInclude(ctx)).toThrow('expected include');
  });

  test('parses include with only', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'include', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'other', lineno: 1, colno: 9 },
      { type: TOKEN_SYMBOL, value: 'only', lineno: 1, colno: 15 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 19 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const templateNode = { lineno: 1, colno: 9 };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        nextToken(ctx);
        return templateNode;
      },
    });

    const result = parseInclude(ctx);

    expect(nodes.isInclude(result)).toBe(true);
    expect(result.only).toBe(true);
  });

  test('parses include with with', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'include', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'other', lineno: 1, colno: 9 },
      { type: TOKEN_SYMBOL, value: 'with', lineno: 1, colno: 15 },
      { type: TOKEN_SYMBOL, value: 'data', lineno: 1, colno: 20 },
      { type: TOKEN_BLOCK_END, value: '%}', lineno: 1, colno: 24 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const templateNode = { lineno: 1, colno: 9 };
    const dataNode = { lineno: 1, colno: 20 };
    const ctx = Object.assign(createCursor(tokens), {
      parseExpression: () => {
        const tok = seq[n++];
        return tok.value === 'data' ? dataNode : templateNode;
      },
    });

    const result = parseInclude(ctx);

    expect(nodes.isInclude(result)).toBe(true);
    expect(result.with).toBe(dataNode);
  });
});
