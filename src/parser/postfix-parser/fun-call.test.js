import { describe, test, expect } from 'bun:test';
import { parseFunCall } from './fun-call.js';
import { nodes } from '../../nodes/index.js';

describe('parseFunCall', () => {
  test('creates FunCall node with target and parsed signature', () => {
    const args = nodes.nodeList(1, 1, []);
    const ctx = { parseSignature: () => args };
    const tok = { lineno: 1, colno: 5, type: 'left-paren', value: '(' };
    const target = { lineno: 1, colno: 1, type: 'symbol', value: 'foo' };

    const result = parseFunCall(ctx, tok, target);

    expect(nodes.isFunCall(result)).toBe(true);
    expect(result.lineno).toBe(1);
    expect(result.colno).toBe(5);
    expect(result.name).toBe(target);
    expect(result.args).toBe(args);
  });
});
