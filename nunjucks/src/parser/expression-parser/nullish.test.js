import { describe, test, expect } from 'bun:test';
import { parseNullishCoalesce } from './nullish.js';
import { NullishCoalesce, Literal } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_OPERATOR } from '../../lexer/token-types.js';

describe('parseNullishCoalesce', () => {
  test('returns single primary when no ?? operator', () => {
    const ctx = Object.assign(createCursor({ nextToken: () => ({ type: 'symbol', value: 'end', lineno: 1, colno: 1 }) }), {
      parsePrimary: () => new Literal(1, 1, 'hello'),
      parsePipe: (node) => node,
    });

    const result = parseNullishCoalesce(ctx);

    expect(result).toEqual(new Literal(1, 1, 'hello'));
  });

  test('creates NullishCoalesce nodes for ?? operators', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '??', lineno: 1, colno: 3 },
      { type: 'symbol', value: 'end', lineno: 1, colno: 5 },
    ];
    let n = 0;
    const left = new Literal(1, 1, 'a');
    const right = new Literal(1, 4, 'b');
    let primaryCall = 0;
    const ctx = Object.assign(createCursor({ nextToken: () => seq[n++] }), {
      parsePrimary: () => {
        const nodes = [left, right];
        return nodes[primaryCall++];
      },
      parsePipe: (node) => node,
    });

    const result = parseNullishCoalesce(ctx);

    expect(result).toBeInstanceOf(NullishCoalesce);
    expect(result.left).toBe(left);
    expect(result.right).toBe(right);
  });

  test('chains multiple ?? operators', () => {
    const seq = [
      { type: TOKEN_OPERATOR, value: '??', lineno: 1, colno: 3 },
      { type: TOKEN_OPERATOR, value: '??', lineno: 1, colno: 7 },
      { type: 'symbol', value: 'end', lineno: 1, colno: 11 },
    ];
    let n = 0;
    const values = [new Literal(1, 1, 'a'), new Literal(1, 5, 'b'), new Literal(1, 9, 'c')];
    let primaryCall = 0;
    const ctx = Object.assign(createCursor({ nextToken: () => seq[n++] }), {
      parsePrimary: () => values[primaryCall++],
      parsePipe: (node) => node,
    });

    const result = parseNullishCoalesce(ctx);

    expect(result).toBeInstanceOf(NullishCoalesce);
    expect(result.left).toBeInstanceOf(NullishCoalesce);
    expect(result.left.left).toBe(values[0]);
    expect(result.left.right).toBe(values[1]);
    expect(result.right).toBe(values[2]);
  });
});
