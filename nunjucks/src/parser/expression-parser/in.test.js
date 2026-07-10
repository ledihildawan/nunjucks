import { describe, test, expect } from 'bun:test';
import { parseIn } from './in.js';
import { In, Not, Literal } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseIn', () => {
  test('creates In node for in operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'in', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 'x');
    const right = new Literal(1, 6, [1, 2]);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (n) => n,
    });

    const result = parseIn(ctx);

    expect(result).toBeInstanceOf(In);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });

  test('creates Not(In) for not in operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'not', lineno: 1, colno: 3 },
      { type: TOKEN_SYMBOL, value: 'in', lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 'x');
    const right = new Literal(1, 10, [1, 2]);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (n) => n,
    });

    const result = parseIn(ctx);

    expect(result).toBeInstanceOf(Not);
    expect(result.target).toBeInstanceOf(In);
    expect(result.target.left).toBe(left);
    expect(result.target.right).toBe(right);
  });

  test('passes through without in', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = new Literal(1, 1, 'x');
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (n) => n,
    });

    expect(parseIn(ctx)).toBe(node);
  });
});
