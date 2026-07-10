import { describe, test, expect } from 'bun:test';
import { parseOr, parseAnd, parseNot } from './logical.js';
import { Or, And, Not, Literal } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseOr', () => {
  test('creates Or node for or operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'or', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, true);
    const right = new Literal(1, 6, false);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (n) => n,
    });

    const result = parseOr(ctx);

    expect(result).toBeInstanceOf(Or);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });

  test('returns single node without or', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = new Literal(1, 1, true);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (n) => n,
    });

    expect(parseOr(ctx)).toBe(node);
  });
});

describe('parseAnd', () => {
  test('creates And node for and operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'and', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, true);
    const right = new Literal(1, 7, false);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (n) => n,
    });

    const result = parseAnd(ctx);

    expect(result).toBeInstanceOf(And);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });

  test('returns single node without and', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = new Literal(1, 1, true);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (n) => n,
    });

    expect(parseAnd(ctx)).toBe(node);
  });
});

describe('parseNot', () => {
  test('creates Not node for not operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'not', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const node = new Literal(1, 5, false);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (n) => n,
    });

    const result = parseNot(ctx);

    expect(result).toBeInstanceOf(Not);
    expect(result.target).toBe(node);
  });

  test('passes through without not', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = new Literal(1, 1, true);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (n) => n,
    });

    expect(parseNot(ctx)).toBe(node);
  });

  test('chains not not', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'not', lineno: 1, colno: 1 },
      { type: TOKEN_SYMBOL, value: 'not', lineno: 1, colno: 5 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const node = new Literal(1, 9, true);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (n) => n,
    });

    const result = parseNot(ctx);

    expect(result).toBeInstanceOf(Not);
    expect(result.target).toBeInstanceOf(Not);
    expect(result.target.target).toBe(node);
  });
});
