import { describe, test, expect } from 'bun:test';
import { parseIs } from './is.js';
import { Is, Not, Literal } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseIs', () => {
  test('creates Is node for is operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'is', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 'x');
    const right = new Literal(1, 6, 'defined');
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (n) => n,
    });

    const result = parseIs(ctx);

    expect(result).toBeInstanceOf(Is);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });

  test('creates Not(Is) for is not operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'is', lineno: 1, colno: 3 },
      { type: TOKEN_SYMBOL, value: 'not', lineno: 1, colno: 6 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 'x');
    const right = new Literal(1, 10, 'undefined');
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (n) => n,
    });

    const result = parseIs(ctx);

    expect(result).toBeInstanceOf(Not);
    expect(result.target).toBeInstanceOf(Is);
    expect(result.target.left).toBe(left);
    expect(result.target.right).toBe(right);
  });

  test('passes through without is', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = new Literal(1, 1, 'x');
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (n) => n,
    });

    expect(parseIs(ctx)).toBe(node);
  });
});
