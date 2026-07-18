import { describe, test, expect } from 'bun:test';
import { parseNullishCoalesce } from './nullish.js';
import { nodes } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_OPERATOR } from '../../lexer/token-types.js';

describe('parseNullishCoalesce', () => {
  test('returns single primary when no ?? operator', () => {
    const ctx = Object.assign(createCursor({ nextToken: () => ({ type: 'symbol', value: 'end', lineno: 1, colno: 1 }) }), {
      parsePrimary: () => nodes.literal(1, 1, 'hello'),
      parsePipe: (node) => node,
    });

    const result = parseNullishCoalesce(ctx);

    expect(nodes.getNodeTypeName(result)).toBe('literal');
    expect(result.value).toBe('hello');
    expect(result.lineno).toBe(1);
    expect(result.colno).toBe(1);
  });

  test('creates NullishCoalesce nodes for ?? operators', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '??', lineno: 1, colno: 3 },
      { type: 'symbol', value: 'end', lineno: 1, colno: 5 },
    ];
    let n = 0;
    const left = nodes.literal(1, 1, 'a');
    const right = nodes.literal(1, 4, 'b');
    let primaryCall = 0;
    const ctx = Object.assign(createCursor({ nextToken: () => seq[n++] }), {
      parsePrimary: () => {
        const items = [left, right];
        return items[primaryCall++];
      },
      parsePipe: (node) => node,
    });

    const result = parseNullishCoalesce(ctx);

    expect(nodes.isNullishCoalesce(result)).toBe(true);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
    expect(result.lineno).toBe(1);
    expect(result.colno).toBe(3);
  });

  test('chains multiple ?? operators', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '??', lineno: 1, colno: 3 },
      { type: TOKEN_OPERATOR, value: '??', lineno: 1, colno: 7 },
      { type: 'symbol', value: 'end', lineno: 1, colno: 11 },
    ];
    let n = 0;
    const values = [nodes.literal(1, 1, 'a'), nodes.literal(1, 5, 'b'), nodes.literal(1, 9, 'c')];
    let primaryCall = 0;
    const ctx = Object.assign(createCursor({ nextToken: () => seq[n++] }), {
      parsePrimary: () => values[primaryCall++],
      parsePipe: (node) => node,
    });

    const result = parseNullishCoalesce(ctx);

    expect(nodes.isNullishCoalesce(result)).toBe(true);
    expect(nodes.isNullishCoalesce(result.left)).toBe(true);
    expect(result.left.left).toBe(values[0]);
    expect(result.left.right).toBe(values[1]);
    expect(result.left.colno).toBe(3);
    expect(result.right).toBe(values[2]);
    expect(result.colno).toBe(7);
  });
});
