import { describe, test, expect } from 'bun:test';
import { parseCompare } from './compare.js';
import { nodes } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_OPERATOR, TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseCompare', () => {
  test('creates Compare node for == operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '==', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = nodes.literal(1, 1, 1);
    const right = nodes.literal(1, 6, 1);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseCompare(ctx);

    expect(nodes.isCompare(result)).toBe(true);
    expect(result.expr).toBe(left);
    expect(result.ops).toHaveLength(1);
    expect(nodes.getNodeTypeName(result.ops[0])).toBe('compareOperand');
    expect(result.ops[0].operator).toBe('==');
    expect(result.ops[0].expr).toBe(right);
  });

  test('creates Compare for != operator', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '!=', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = nodes.literal(1, 1, 1);
    const right = nodes.literal(1, 6, 2);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseCompare(ctx);
    expect(result.ops[0].operator).toBe('!=');
  });

  test('chains multiple comparisons', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '<', lineno: 1, colno: 3 },
      { type: TOKEN_OPERATOR, value: '<', lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const a = nodes.literal(1, 1, 1);
    const b = nodes.literal(1, 5, 2);
    const c = nodes.literal(1, 9, 3);
    let calls = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        const v = [a, b, c];
        return v[calls++];
      },
      parsePipe: (x) => x,
    });

    const result = parseCompare(ctx);

    expect(nodes.isCompare(result)).toBe(true);
    expect(result.ops).toHaveLength(2);
  });

  test('passes through without comparison', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = nodes.literal(1, 1, 42);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (x) => x,
    });

    expect(parseCompare(ctx)).toBe(node);
  });
});
