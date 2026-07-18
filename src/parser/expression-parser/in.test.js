import { describe, test, expect } from 'bun:test';
import { parseIn } from './in.js';
import { nodes } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseIn', () => {
  test('creates In node for in operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'in', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const left = nodes.literal(1, 1, 'x');
    const right = nodes.literal(1, 6, [1, 2]);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseIn(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('in');
    expect(result.lineno).toBe(1);
    expect(result.colno).toBe(3);
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
    const left = nodes.literal(1, 1, 'x');
    const right = nodes.literal(1, 10, [1, 2]);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => { const v = [left, right]; return v[c++]; },
      parsePipe: (x) => x,
    });

    const result = parseIn(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('not');
    expect(result.lineno).toBe(1);
    expect(result.colno).toBe(3);
    expect(nodes.getNodeTypeName(result.target)).toBe('in');
    expect(result.target.lineno).toBe(1);
    expect(result.target.colno).toBe(7);
    expect(result.target.left).toBe(left);
    expect(result.target.right).toBe(right);
  });

  test('passes through without in', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = nodes.literal(1, 1, 'x');
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (x) => x,
    });

    expect(parseIn(ctx)).toBe(node);
  });
});
