import { describe, expect, test } from 'bun:test';
import type { TemplateQuasi, Token } from './token-types.ts';
import {
  TOKEN_BLOCK_END,
  TOKEN_FLOAT,
  TOKEN_INT,
  TOKEN_REGEX,
  TOKEN_STRING,
  TOKEN_SYMBOL,
  TOKEN_TEMPLATE_LITERAL,
  TOKEN_VARIABLE_END,
} from './token-types.ts';
import {
  createNumberToken,
  createToken,
  isBlockEndToken,
  isStringToken,
  isSymbolToken,
  isVariableEndToken,
} from './tokens.ts';

const stringToken = createToken({ type: TOKEN_STRING, value: 'hello', lineno: 1, colno: 2 });
const symbolToken = createToken({ type: TOKEN_SYMBOL, value: 'foo', lineno: 3, colno: 4 });
const blockEndToken = createToken({ type: TOKEN_BLOCK_END, value: '%}', lineno: 5, colno: 6 });
const variableEndToken = createToken({
  type: TOKEN_VARIABLE_END,
  value: '}}',
  lineno: 7,
  colno: 8,
});
const intToken = createToken({ type: TOKEN_INT, value: 42, lineno: 9, colno: 10 });
const floatToken = createToken({ type: TOKEN_FLOAT, value: 3.14, lineno: 11, colno: 12 });
const regexToken = createToken({
  type: TOKEN_REGEX,
  value: { body: 'abc', flags: 'g' },
  lineno: 13,
  colno: 14,
});
const templateLiteralToken = createToken({
  type: TOKEN_TEMPLATE_LITERAL,
  value: { quasis: [] as TemplateQuasi[], expressions: [] },
  lineno: 15,
  colno: 16,
});

describe('createToken', () => {
  test('sets every core field verbatim for a string-valued token', () => {
    const token = createToken({ type: TOKEN_STRING, value: 'hello', lineno: 12, colno: 7 });
    expect(token.type).toBe(TOKEN_STRING);
    expect(token.value).toBe('hello');
    expect(token.lineno).toBe(12);
    expect(token.colno).toBe(7);
  });

  test('preserves a numeric value through the generic value slot', () => {
    const token = createToken({ type: TOKEN_INT, value: 2048, lineno: 4, colno: 2 });
    expect(token.type).toBe(TOKEN_INT);
    expect(token.value).toBe(2048);
  });

  test('preserves an object value through the generic value slot', () => {
    const token = createToken({
      type: TOKEN_REGEX,
      value: { body: 'abc', flags: 'gi' },
      lineno: 1,
      colno: 1,
    });
    expect(token.value).toEqual({ body: 'abc', flags: 'gi' });
  });

  test('omits strip flags entirely when no strip argument is supplied', () => {
    const token = createToken({ type: TOKEN_STRING, value: 'hello', lineno: 1, colno: 1 });
    expect(token.stripLeft).toBeUndefined();
    expect(token.stripRight).toBeUndefined();
    expect(Object.hasOwn(token, 'stripLeft')).toBe(false);
    expect(Object.hasOwn(token, 'stripRight')).toBe(false);
  });

  const stripScenarios: ReadonlyArray<{
    name: string;
    strip: { stripLeft?: boolean; stripRight?: boolean };
    expectedLeft: boolean | undefined;
    expectedRight: boolean | undefined;
  }> = [
    {
      name: 'stripLeft only',
      strip: { stripLeft: true },
      expectedLeft: true,
      expectedRight: undefined,
    },
    {
      name: 'stripRight only',
      strip: { stripRight: true },
      expectedLeft: undefined,
      expectedRight: true,
    },
    {
      name: 'both sides',
      strip: { stripLeft: true, stripRight: true },
      expectedLeft: true,
      expectedRight: true,
    },
  ];

  test('sets strip flags according to the provided strip argument', () => {
    stripScenarios.forEach(({ name, strip, expectedLeft, expectedRight }) => {
      const token = createToken({ type: TOKEN_STRING, value: 'x', lineno: 1, colno: 1, strip });
      expect({ name, left: token.stripLeft, right: token.stripRight }).toEqual({
        name,
        left: expectedLeft,
        right: expectedRight,
      });
    });
  });

  test('drops strip flags that are explicitly false', () => {
    const token = createToken({
      type: TOKEN_STRING,
      value: 'x',
      lineno: 1,
      colno: 1,
      strip: { stripLeft: false, stripRight: false },
    });
    expect(token.stripLeft).toBeUndefined();
    expect(token.stripRight).toBeUndefined();
    expect(Object.hasOwn(token, 'stripLeft')).toBe(false);
    expect(Object.hasOwn(token, 'stripRight')).toBe(false);
  });
});

describe('createNumberToken', () => {
  const numberCases: ReadonlyArray<{
    name: string;
    value: number;
    hasDecimal: boolean;
    expectedType: typeof TOKEN_INT | typeof TOKEN_FLOAT;
  }> = [
    { name: 'integer', value: 42, hasDecimal: false, expectedType: TOKEN_INT },
    { name: 'decimal', value: 3.14, hasDecimal: true, expectedType: TOKEN_FLOAT },
  ];

  test('emits TOKEN_INT without decimals and TOKEN_FLOAT with decimals', () => {
    numberCases.forEach(({ name, value, hasDecimal, expectedType }) => {
      const token = createNumberToken({ value, lineno: 1, colno: 1, hasDecimal });
      expect({ name, type: token.type, value: token.value }).toEqual({
        name,
        type: expectedType,
        value,
      });
    });
  });

  test('forwards lineno/colno verbatim and carries no strip flags', () => {
    numberCases.forEach(({ name, value, hasDecimal }) => {
      const token = createNumberToken({ value, lineno: 17, colno: 9, hasDecimal });
      expect({
        name,
        lineno: token.lineno,
        colno: token.colno,
        stripLeft: token.stripLeft,
        stripRight: token.stripRight,
      }).toEqual({
        name,
        lineno: 17,
        colno: 9,
        stripLeft: undefined,
        stripRight: undefined,
      });
    });
  });
});

describe('isStringToken', () => {
  const stringValuedTokens: ReadonlyArray<{ name: string; token: Token }> = [
    { name: 'string', token: stringToken },
    { name: 'symbol', token: symbolToken },
    { name: 'block-end', token: blockEndToken },
    { name: 'variable-end', token: variableEndToken },
  ];
  const nonStringValuedTokens: ReadonlyArray<{ name: string; token: Token }> = [
    { name: 'int', token: intToken },
    { name: 'float', token: floatToken },
    { name: 'regex', token: regexToken },
    { name: 'template-literal', token: templateLiteralToken },
  ];

  test('returns true for tokens whose value is a string', () => {
    stringValuedTokens.forEach(({ name, token }) => {
      expect({ name, result: isStringToken(token) }).toEqual({ name, result: true });
    });
  });

  test('returns false for tokens whose value is not a string', () => {
    nonStringValuedTokens.forEach(({ name, token }) => {
      expect({ name, result: isStringToken(token) }).toEqual({ name, result: false });
    });
  });
});

describe('isSymbolToken', () => {
  const nonSymbolTokens: ReadonlyArray<{ name: string; token: Token }> = [
    { name: 'string', token: stringToken },
    { name: 'block-end', token: blockEndToken },
    { name: 'variable-end', token: variableEndToken },
    { name: 'int', token: intToken },
    { name: 'float', token: floatToken },
    { name: 'regex', token: regexToken },
    { name: 'template-literal', token: templateLiteralToken },
  ];

  test('returns true for a symbol token', () => {
    expect(isSymbolToken(symbolToken)).toBe(true);
  });

  test('returns false for every non-symbol token type', () => {
    nonSymbolTokens.forEach(({ name, token }) => {
      expect({ name, result: isSymbolToken(token) }).toEqual({ name, result: false });
    });
  });
});

describe('isBlockEndToken', () => {
  const nonBlockEndTokens: ReadonlyArray<{ name: string; token: Token }> = [
    { name: 'string', token: stringToken },
    { name: 'symbol', token: symbolToken },
    { name: 'variable-end', token: variableEndToken },
    { name: 'int', token: intToken },
    { name: 'float', token: floatToken },
    { name: 'regex', token: regexToken },
    { name: 'template-literal', token: templateLiteralToken },
  ];

  test('returns true for a block-end token', () => {
    expect(isBlockEndToken(blockEndToken)).toBe(true);
  });

  test('returns false for every non-block-end token type', () => {
    nonBlockEndTokens.forEach(({ name, token }) => {
      expect({ name, result: isBlockEndToken(token) }).toEqual({ name, result: false });
    });
  });
});

describe('isVariableEndToken', () => {
  const nonVariableEndTokens: ReadonlyArray<{ name: string; token: Token }> = [
    { name: 'string', token: stringToken },
    { name: 'symbol', token: symbolToken },
    { name: 'block-end', token: blockEndToken },
    { name: 'int', token: intToken },
    { name: 'float', token: floatToken },
    { name: 'regex', token: regexToken },
    { name: 'template-literal', token: templateLiteralToken },
  ];

  test('returns true for a variable-end token', () => {
    expect(isVariableEndToken(variableEndToken)).toBe(true);
  });

  test('returns false for every non-variable-end token type', () => {
    nonVariableEndTokens.forEach(({ name, token }) => {
      expect({ name, result: isVariableEndToken(token) }).toEqual({ name, result: false });
    });
  });
});
