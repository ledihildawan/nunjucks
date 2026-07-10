import { describe, test, expect } from 'bun:test';
import { parsePrimary } from './primary.js';
import { Literal, AstSymbol } from '../../nodes/index.js';
import { createCursor } from '../cursor.js';
import { TOKEN_STRING, TOKEN_INT, TOKEN_FLOAT, TOKEN_BOOLEAN, TOKEN_NONE, TOKEN_REGEX, TOKEN_SYMBOL } from '../../lexer/token-types.js';

describe('parsePrimary', () => {
  test('parses string literal', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_STRING, value: 'hello', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => n,
      parseAggregate: () => { throw new Error('should not be called'); },
    });

    const result = parsePrimary(ctx);

    expect(result).toBeInstanceOf(Literal);
    expect(result.value).toBe('hello');
  });

  test('parses int literal', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_INT, value: '42', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => n,
    });

    const result = parsePrimary(ctx);

    expect(result).toBeInstanceOf(Literal);
    expect(result.value).toBe(42);
  });

  test('parses float literal', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_FLOAT, value: '3.14', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => n,
    });

    const result = parsePrimary(ctx);

    expect(result).toBeInstanceOf(Literal);
    expect(result.value).toBe(3.14);
  });

  test('parses boolean true', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_BOOLEAN, value: 'true', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => n,
    });

    const result = parsePrimary(ctx);

    expect(result).toBeInstanceOf(Literal);
    expect(result.value).toBe(true);
  });

  test('parses boolean false', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_BOOLEAN, value: 'false', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => n,
    });

    const result = parsePrimary(ctx);

    expect(result).toBeInstanceOf(Literal);
    expect(result.value).toBe(false);
  });

  test('parses none', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_NONE, value: 'none', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => n,
    });

    const result = parsePrimary(ctx);

    expect(result).toBeInstanceOf(Literal);
    expect(result.value).toBeNull();
  });

  test('parses regex literal', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_REGEX, value: { body: '\\d+', flags: 'g' }, lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => n,
    });

    const result = parsePrimary(ctx);

    expect(result).toBeInstanceOf(Literal);
    expect(result.value).toBeInstanceOf(RegExp);
    expect(result.value.source).toBe('\\d+');
    expect(result.value.flags).toBe('g');
  });

  test('parses symbol', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'myVar', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => n,
    });

    const result = parsePrimary(ctx);

    expect(result).toBeInstanceOf(AstSymbol);
    expect(result.value).toBe('myVar');
  });

  test('calls parsePostfix when noPostfix is false', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    let postfixCalled = false;
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => { postfixCalled = true; return n; },
    });

    parsePrimary(ctx);

    expect(postfixCalled).toBe(true);
  });

  test('skips parsePostfix when noPostfix is true', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_SYMBOL, value: 'x', lineno: 1, colno: 1 }) };
    let postfixCalled = false;
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => { postfixCalled = true; return n; },
    });

    parsePrimary(ctx, true);

    expect(postfixCalled).toBe(false);
  });

  test('calls parseAggregate for unknown token type', () => {
    const tokens = { nextToken: () => ({ type: 'unknown', value: '(', lineno: 1, colno: 1 }) };
    const subNode = new AstSymbol(1, 2, 'expr');
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => n,
      parseAggregate: () => subNode,
    });

    const result = parsePrimary(ctx);

    expect(result).toBe(subNode);
  });

  test('fails on invalid boolean', () => {
    const tokens = { nextToken: () => ({ type: TOKEN_BOOLEAN, value: 'maybe', lineno: 1, colno: 1 }) };
    const ctx = Object.assign(createCursor(tokens), {
      parsePostfix: (n) => n,
    });

    expect(() => parsePrimary(ctx)).toThrow('invalid boolean');
  });

  test('fails on null token', () => {
    const tokens = { nextToken: () => null };
    const ctx = Object.assign(createCursor(tokens));

    expect(() => parsePrimary(ctx)).toThrow('expected expression');
  });
});
