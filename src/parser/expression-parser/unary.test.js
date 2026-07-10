import { describe, test, expect } from 'bun:test';
import { parseUnary } from './unary.js';
import { Neg, Pos, Literal } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_OPERATOR, TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseUnary', () => {
  test('passes through without unary operator', () => {
    const ctx = Object.assign(createCursor({ nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) }), {
      parsePrimary: () => Literal(1, 1, 42),
      parsePipe: (node) => node,
    });

    const result = parseUnary(ctx);

    expect(result).toEqual(Literal(1, 1, 42));
  });

  test('creates Neg for - prefix', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '-', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const value = Literal(1, 2, 42);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => value,
      parsePipe: (node) => node,
    });

    const result = parseUnary(ctx);

    expect(result).toBeInstanceOf(Neg);
    expect(result.target).toBe(value);
  });

  test('creates Pos for + prefix', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '+', lineno: 1, colno: 1 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const value = Literal(1, 2, 42);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => value,
      parsePipe: (node) => node,
    });

    const result = parseUnary(ctx);

    expect(result).toBeInstanceOf(Pos);
    expect(result.target).toBe(value);
  });

  test('chains multiple unary operators', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '-', lineno: 1, colno: 1 },
      { type: TOKEN_OPERATOR, value: '-', lineno: 1, colno: 2 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const value = Literal(1, 3, 42);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => value,
      parsePipe: (node) => node,
    });

    const result = parseUnary(ctx);

    expect(result).toBeInstanceOf(Neg);
    expect(result.target).toBeInstanceOf(Neg);
    expect(result.target.target).toBe(value);
  });

  test('calls parsePipe when noPipes is false', () => {
    const seq = [];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    let pipeCalled = false;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        n++; return Literal(1, 1, 42);
      },
      parsePipe: (node) => { pipeCalled = true; return node; },
    });

    parseUnary(ctx);

    expect(pipeCalled).toBe(true);
  });

  test('skips parsePipe when noPipes is true', () => {
    const seq = [];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    let pipeCalled = false;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        n++; return Literal(1, 1, 42);
      },
      parsePipe: (node) => { pipeCalled = true; return node; },
    });

    parseUnary(ctx, true);

    expect(pipeCalled).toBe(false);
  });
});
