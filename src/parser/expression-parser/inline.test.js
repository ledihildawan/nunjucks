import { describe, test, expect } from 'bun:test';
import { parseInlineIf } from './inline.js';
import { InlineIf, Literal } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parseInlineIf', () => {
  test('passes through without if', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    const node = new Literal(1, 1, 42);
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => node,
      parsePipe: (n) => n,
    });

    expect(parseInlineIf(ctx)).toBe(node);
  });

  test('creates InlineIf for if operator', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'if', lineno: 1, colno: 3 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const body = new Literal(1, 1, 42);
    const cond = new Literal(1, 6, true);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        const v = [body, cond];
        return v[c++];
      },
      parsePipe: (n) => n,
    });

    const result = parseInlineIf(ctx);

    expect(result).toBeInstanceOf(InlineIf);
    expect(result.body).toBe(body);
    expect(result.cond).toBe(cond);
    expect(result.else_).toBeNull();
  });

  test('creates InlineIf with else', () => {
    const seq = [
      { type: TOKEN_SYMBOL, value: 'if', lineno: 1, colno: 3 },
      { type: TOKEN_SYMBOL, value: 'else', lineno: 1, colno: 7 },
    ];
    let n = 0;
    const tokens = { nextToken: () => seq[n++] };
    const body = new Literal(1, 1, 42);
    const cond = new Literal(1, 6, false);
    const else_ = new Literal(1, 12, 0);
    let c = 0;
    const ctx = Object.assign(createCursor(tokens), {
      parsePrimary: () => {
        const v = [body, cond, else_];
        return v[c++];
      },
      parsePipe: (n) => n,
    });

    const result = parseInlineIf(ctx);

    expect(result).toBeInstanceOf(InlineIf);
    expect(result.body).toBe(body);
    expect(result.cond).toBe(cond);
    expect(result.else_).toBe(else_);
  });
});
