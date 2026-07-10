import { describe, test, expect } from 'bun:test';
import { parseDotAccess } from './dot.js';
import { LookupVal, Literal } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseDotAccess', () => {
  test('parses dot access with symbol', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'bar', lineno: 1, colno: 3 },
      { type: TOKEN_SYMBOL, value: 'bar', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);
    const tok = { lineno: 1, colno: 2, type: 'operator', value: '.' };
    const target = { lineno: 1, colno: 1, typename: 'Symbol', value: 'foo' };

    const result = parseDotAccess(ctx, tok, target);

    expect(result).toBeInstanceOf(LookupVal);
    expect(result.lineno).toBe(1);
    expect(result.colno).toBe(2);
    expect(result.target).toBe(target);
    expect(result.val).toBeInstanceOf(Literal);
    expect(result.val.value).toBe('bar');
  });

  test('fails on non-symbol token', () => {
    const seq = [
      { type: 'int', value: '42', lineno: 1, colno: 3 },
      { type: 'int', value: '42', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const ctx = createCursor(tokens);
    const tok = { lineno: 1, colno: 2, type: 'operator', value: '.' };
    const target = { lineno: 1, colno: 1, typename: 'Symbol', value: 'foo' };

    expect(() => parseDotAccess(ctx, tok, target)).toThrow('expected name');
  });
});
