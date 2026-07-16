import { describe, test, expect } from 'bun:test';
import { parseOr, parseAnd, parseNot } from './logical.js';
import { nodes } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL, TOKEN_OPERATOR } from '../../lexer/token-types.js';

describe('parseOr', () => {
  test('creates Or node for or operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'or', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = nodes.literal(1, 1, true);
    const right = nodes.literal(1, 6, false);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseOr(ctx);

    expect(nodes.isOr(result)).toBe(true);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });

  test('creates Or node for || operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '||', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = nodes.literal(1, 1, true);
    const right = nodes.literal(1, 6, false);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseOr(ctx);

    expect(nodes.isOr(result)).toBe(true);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });

  test('returns single node without or', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = nodes.literal(1, 1, true);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (x) => x,
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
    const left = nodes.literal(1, 1, true);
    const right = nodes.literal(1, 7, false);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseAnd(ctx);

    expect(nodes.isAnd(result)).toBe(true);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });

  test('creates And node for && operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '&&', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = nodes.literal(1, 1, true);
    const right = nodes.literal(1, 6, false);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseAnd(ctx);

    expect(nodes.isAnd(result)).toBe(true);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });

  test('returns single node without and', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = nodes.literal(1, 1, true);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (x) => x,
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
    const node = nodes.literal(1, 5, false);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (x) => x,
    });

    const result = parseNot(ctx);

    expect(nodes.isNot(result)).toBe(true);
    expect(result.target).toBe(node);
  });

  test('creates Not node for ! operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '!', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const node = nodes.literal(1, 2, false);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (x) => x,
    });

    const result = parseNot(ctx);

    expect(nodes.isNot(result)).toBe(true);
    expect(result.target).toBe(node);
  });

  test('passes through without not', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = nodes.literal(1, 1, true);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (x) => x,
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
    const node = nodes.literal(1, 9, true);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (x) => x,
    });

    const result = parseNot(ctx);

    expect(nodes.isNot(result)).toBe(true);
    expect(nodes.isNot(result.target)).toBe(true);
    expect(result.target.target).toBe(node);
  });
});
