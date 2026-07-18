import { describe, test, expect } from 'bun:test';
import { parseIs } from './is.js';
import { nodes } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseIs', () => {
  test('creates Is node for is operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'is', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = nodes.literal(1, 1, 'x');
    const right = nodes.literal(1, 6, 'defined');
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseIs(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('is');
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
    expect(result.lineno).toBe(1);
    expect(result.colno).toBe(3);
  });

  test('creates Not(Is) for is not operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'is', lineno: 1, colno: 3 },
      { type: TOKEN_SYMBOL, value: 'not', lineno: 1, colno: 6 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = nodes.literal(1, 1, 'x');
    const right = nodes.literal(1, 10, 'undefined');
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseIs(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('not');
    expect(nodes.getNodeTypeName(result.target)).toBe('is');
    expect(result.target.left).toBe(left);
    expect(result.target.right).toBe(right);
    expect(result.lineno).toBe(1);
    expect(result.colno).toBe(3);
    expect(result.target.colno).toBe(3);
  });

  test('passes through without is', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = nodes.literal(1, 1, 'x');
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (x) => x,
    });

    expect(parseIs(ctx)).toBe(node);
  });
});
