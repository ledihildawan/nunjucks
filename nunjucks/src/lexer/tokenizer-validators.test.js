import { describe, test, expect } from 'bun:test';
import {
  isComplexOperator,
  isValidRegexFlag,
  isNumericString,
  isBooleanString,
  isNullString,
} from './tokenizer-validators.js';

describe('isComplexOperator', () => {
  test('returns true for complex operators', () => {
    const complexOps = ['==', '!=', '<=', '>=', '===', '!=='];
    expect(isComplexOperator('==', complexOps)).toBe(true);
    expect(isComplexOperator('!=', complexOps)).toBe(true);
    expect(isComplexOperator('<=', complexOps)).toBe(true);
    expect(isComplexOperator('>=', complexOps)).toBe(true);
    expect(isComplexOperator('===', complexOps)).toBe(true);
    expect(isComplexOperator('!==', complexOps)).toBe(true);
  });

  test('returns false for simple operators', () => {
    const complexOps = ['==', '!=', '<=', '>=', '===', '!=='];
    expect(isComplexOperator('+', complexOps)).toBe(false);
    expect(isComplexOperator('-', complexOps)).toBe(false);
    expect(isComplexOperator('*', complexOps)).toBe(false);
    expect(isComplexOperator('/', complexOps)).toBe(false);
  });

  test('returns false for empty string', () => {
    const complexOps = ['==', '!='];
    expect(isComplexOperator('', complexOps)).toBe(false);
  });
});

describe('isValidRegexFlag', () => {
  test('returns true for valid flags', () => {
    const flags = 'gimsuy';
    expect(isValidRegexFlag('g', flags)).toBe(true);
    expect(isValidRegexFlag('i', flags)).toBe(true);
    expect(isValidRegexFlag('m', flags)).toBe(true);
    expect(isValidRegexFlag('s', flags)).toBe(true);
    expect(isValidRegexFlag('u', flags)).toBe(true);
    expect(isValidRegexFlag('y', flags)).toBe(true);
  });

  test('returns false for invalid flags', () => {
    const flags = 'gimsuy';
    expect(isValidRegexFlag('a', flags)).toBe(false);
    expect(isValidRegexFlag('z', flags)).toBe(false);
    expect(isValidRegexFlag('1', flags)).toBe(false);
  });

  test('handles empty flags', () => {
    expect(isValidRegexFlag('g', '')).toBe(false);
  });
});

describe('isNumericString', () => {
  test('returns true for positive integers', () => {
    expect(isNumericString('123')).toBe(true);
    expect(isNumericString('0')).toBe(true);
    expect(isNumericString('999999')).toBe(true);
  });

  test('returns true for negative integers', () => {
    expect(isNumericString('-123')).toBe(true);
    expect(isNumericString('-0')).toBe(true);
  });

  test('returns true for positive sign', () => {
    expect(isNumericString('+123')).toBe(true);
  });

  test('returns false for floats', () => {
    expect(isNumericString('3.14')).toBe(false);
    expect(isNumericString('-3.14')).toBe(false);
  });

  test('returns false for non-numeric strings', () => {
    expect(isNumericString('abc')).toBe(false);
    expect(isNumericString('')).toBe(false);
    expect(isNumericString('12a')).toBe(false);
    expect(isNumericString('a12')).toBe(false);
  });

  test('returns false for hex numbers', () => {
    expect(isNumericString('0x10')).toBe(false);
  });
});

describe('isBooleanString', () => {
  test('returns true for true', () => {
    expect(isBooleanString('true')).toBe(true);
  });

  test('returns true for false', () => {
    expect(isBooleanString('false')).toBe(true);
  });

  test('returns false for other strings', () => {
    expect(isBooleanString('TRUE')).toBe(false);
    expect(isBooleanString('FALSE')).toBe(false);
    expect(isBooleanString('truee')).toBe(false);
    expect(isBooleanString('fals')).toBe(false);
    expect(isBooleanString('')).toBe(false);
  });
});

describe('isNullString', () => {
  test('returns true for none', () => {
    expect(isNullString('none')).toBe(true);
  });

  test('returns true for null', () => {
    expect(isNullString('null')).toBe(true);
  });

  test('returns false for other strings', () => {
    expect(isNullString('None')).toBe(false);
    expect(isNullString('NULL')).toBe(false);
    expect(isNullString('undefined')).toBe(false);
    expect(isNullString('')).toBe(false);
  });
});
