import { describe, test, expect } from 'bun:test';
import { classifyError, classifyFromError } from './classify.js';
import { DEFAULT_CLASSIFICATION } from '../constants/error-rules.js';

describe('classifyError', () => {
  test('returns DEFAULT_CLASSIFICATION for empty message', () => {
    expect(classifyError(null)).toBe(DEFAULT_CLASSIFICATION);
    expect(classifyError('')).toBe(DEFAULT_CLASSIFICATION);
  });

  test('detects undefined variable', () => {
    const result = classifyError("attempted to output 'x' null or undefined");
    expect(result.category).toBe('undefined_variable');
    expect(result.undefinedName).toBe('x');
  });

  test('detects undefined function', () => {
    const result = classifyError('Unable to call `foo`, which is undefined or falsey');
    expect(result.category).toBe('undefined_function');
    expect(result.undefinedName).toBe('foo');
  });

  test('detects not a function', () => {
    const result = classifyError('Unable to call `bar`, which is not a function');
    expect(result.category).toBe('not_a_function');
    expect(result.undefinedName).toBe('bar');
  });

  test('detects syntax error', () => {
    const result = classifyError('unexpected token');
    expect(result.category).toBe('syntax_error');
  });

  test('detects undefined filter', () => {
    const result = classifyError('filter not found: myfilter');
    expect(result.category).toBe('undefined_filter');
    expect(result.undefinedName).toBe('myfilter');
  });

  test('detects circular include', () => {
    const result = classifyError('Circular include detected');
    expect(result.category).toBe('circular_include');
  });

  test('detects file not found', () => {
    const result = classifyError('template not found: missing.njk');
    expect(result.category).toBe('file_not_found');
    expect(result.undefinedName).toBe('missing.njk');
  });

  test('detects filesystem error', () => {
    const result = classifyError('ENOENT: no such file');
    expect(result.category).toBe('filesystem_error');
  });
});

describe('classifyFromError', () => {
  test('classifies FILTER_ERROR code', () => {
    const error = { code: 'FILTER_ERROR', message: 'Error: something broke' };
    const result = classifyFromError(error);
    expect(result.category).toBe('filter_error');
  });

  test('falls back to classifyError for non-filter errors', () => {
    const error = { code: 'UNDEFINED_VARIABLE', message: "attempted to output 'x' null or undefined" };
    const result = classifyFromError(error);
    expect(result.category).toBe('undefined_variable');
  });

  test('returns defaults for null', () => {
    expect(classifyFromError(null)).toBe(DEFAULT_CLASSIFICATION);
  });
});
