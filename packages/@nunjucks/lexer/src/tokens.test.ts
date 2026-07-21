import { describe, test, expect } from 'bun:test';
import {
  createToken,
  createOperatorToken,
  createNumberToken,
} from './tokens.ts';

describe('createToken', () => {
  test('creates a token with the given fields', () => {
    const token = createToken('symbol', 'foo', 1, 2);
    expect(token).toEqual({ type: 'symbol', value: 'foo', lineno: 1, colno: 2 });
  });

  test('preserves numeric values', () => {
    const token = createToken('int', 42, 0, 0);
    expect(token.value).toBe(42);
    expect(typeof token.value).toBe('number');
  });

  test('preserves boolean values', () => {
    const token = createToken('boolean', true, 0, 0);
    expect(token.value).toBe(true);
  });

  test('preserves null values', () => {
    const token = createToken('none', null, 0, 0);
    expect(token.value).toBeNull();
  });
});

describe('createOperatorToken', () => {
  test('creates an operator token with the given value', () => {
    const token = createOperatorToken('+', 5, 6);
    expect(token.type).toBe('operator');
    expect(token.value).toBe('+');
    expect(token.lineno).toBe(5);
    expect(token.colno).toBe(6);
  });

  test('supports complex operators', () => {
    const token = createOperatorToken('===', 0, 0);
    expect(token.type).toBe('operator');
    expect(token.value).toBe('===');
  });
});

describe('createNumberToken', () => {
  test('creates an int token when hasDecimal is false', () => {
    const token = createNumberToken(42, 1, 1, false);
    expect(token.type).toBe('int');
    expect(token.value).toBe(42);
  });

  test('creates a float token when hasDecimal is true', () => {
    const token = createNumberToken(3.14, 0, 0, true);
    expect(token.type).toBe('float');
    expect(token.value).toBe(3.14);
  });

  test('carries position information', () => {
    const token = createNumberToken(7, 3, 4, false);
    expect(token.lineno).toBe(3);
    expect(token.colno).toBe(4);
  });
});
