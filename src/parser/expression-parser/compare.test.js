import { describe, test, expect } from 'bun:test';
import { parseCompare } from './compare.js';
import { Compare, CompareOperand, Literal } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_OPERATOR, TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseCompare', () => {
  test('creates Compare node for == operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '==', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 1);
    const right = new Literal(1, 6, 1);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (n) => n,
    });

    const result = parseCompare(ctx);

    expect(result).toBeInstanceOf(Compare);
    expect(result.expr).toBe(left);
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]).toBeInstanceOf(CompareOperand);
    expect(result.ops[0].type).toBe('==');
    expect(result.ops[0].expr).toBe(right);
  });

  test('creates Compare for != operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '!=', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = new Literal(1, 1, 1);
    const right = new Literal(1, 6, 2);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (n) => n,
    });

    const result = parseCompare(ctx);
    expect(result.ops[0].type).toBe('!=');
  });

  test('chains multiple comparisons', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '<', lineno: 1, colno: 3 },
      { type: TOKEN_OPERATOR, value: '<', lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const a = new Literal(1, 1, 1);
    const b = new Literal(1, 5, 2);
    const c = new Literal(1, 9, 3);
    let calls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        const v = [a, b, c];
        return v[calls++];
      },
      parsePipe: (n) => n,
    });

    const result = parseCompare(ctx);

    expect(result).toBeInstanceOf(Compare);
    expect(result.ops).toHaveLength(2);
  });

  test('passes through without comparison', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = new Literal(1, 1, 42);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (n) => n,
    });

    expect(parseCompare(ctx)).toBe(node);
  });
});
