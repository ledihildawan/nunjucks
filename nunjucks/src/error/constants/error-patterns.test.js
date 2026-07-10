import { describe, test, expect } from 'bun:test';
import { PATTERNS } from './error-patterns.js';

describe('PATTERNS', () => {
  test('UNDEFINED_VARIABLE matches attempted output of null/undefined', () => {
    expect(PATTERNS.UNDEFINED_VARIABLE.test("attempted to output 'foo' null or undefined")).toBe(true);
    expect(PATTERNS.UNDEFINED_VARIABLE.exec("attempted to output 'bar' null or undefined")?.[1]).toBe('bar');
  });

  test('UNDEFINED_VALUE matches generic null output', () => {
    expect(PATTERNS.UNDEFINED_VALUE.test('attempted to output null or undefined value')).toBe(true);
  });

  test('UNDEFINED_FUNCTION matches unable to call', () => {
    expect(PATTERNS.UNDEFINED_FUNCTION.test("Unable to call `myFn` which is undefined")).toBe(true);
    expect(PATTERNS.UNDEFINED_FUNCTION.test("Unable to call `test` which is falsey")).toBe(true);
    expect(PATTERNS.UNDEFINED_FUNCTION.exec("Unable to call `fn` which is undefined")?.[1]).toBe('fn');
  });

  test('NOT_A_FUNCTION matches is not a function', () => {
    expect(PATTERNS.NOT_A_FUNCTION.test('foo is not a function')).toBe(true);
    expect(PATTERNS.NOT_A_FUNCTION.test('bar is not defined')).toBe(true);
  });

  test('SYNTAX_ERROR matches various syntax errors', () => {
    expect(PATTERNS.SYNTAX_ERROR.test('unexpected token')).toBe(true);
    expect(PATTERNS.SYNTAX_ERROR.test('expected comma')).toBe(true);
    expect(PATTERNS.SYNTAX_ERROR.test('expected variable end')).toBe(true);
    expect(PATTERNS.SYNTAX_ERROR.test('ParseError')).toBe(true);
    expect(PATTERNS.SYNTAX_ERROR.test('SyntaxError')).toBe(true);
  });

  test('UNDEFINED_FILTER matches filter not found', () => {
    expect(PATTERNS.UNDEFINED_FILTER.test('filter not found: upper')).toBe(true);
    expect(PATTERNS.UNDEFINED_FILTER.exec('filter not found: myfilter')?.[1]).toBe('myfilter');
  });

  test('UNDEFINED_BLOCK matches unknown block', () => {
    expect(PATTERNS.UNDEFINED_BLOCK.test('block "main" not found')).toBe(true);
    expect(PATTERNS.UNDEFINED_BLOCK.test('undefined block')).toBe(true);
  });

  test('NO_SUPER_BLOCK matches no super block', () => {
    expect(PATTERNS.NO_SUPER_BLOCK.test('no super block available')).toBe(true);
  });

  test('CIRCULAR_INCLUDE matches circular include', () => {
    expect(PATTERNS.CIRCULAR_INCLUDE.test('Circular include detected')).toBe(true);
  });

  test('FILE_NOT_FOUND matches template not found', () => {
    expect(PATTERNS.FILE_NOT_FOUND.test('template not found: foo.html')).toBe(true);
    expect(PATTERNS.FILE_NOT_FOUND.exec('template not found: missing.njk')?.[1]).toBe('missing.njk');
  });

  test('INVALID_INCLUDE matches non-string template names', () => {
    expect(PATTERNS.INVALID_INCLUDE.test('template names must be a string')).toBe(true);
  });

  test('FILESYSTEM_ERROR matches EISDIR, ENOENT, permission denied', () => {
    expect(PATTERNS.FILESYSTEM_ERROR.test('ENOENT: no such file')).toBe(true);
    expect(PATTERNS.FILESYSTEM_ERROR.test('EISDIR: illegal operation')).toBe(true);
    expect(PATTERNS.FILESYSTEM_ERROR.test('permission denied')).toBe(true);
  });

  test('FILTER_ERROR matches Error: prefix', () => {
    expect(PATTERNS.FILTER_ERROR.test('Error: something went wrong')).toBe(true);
  });

  test('LINE_INFO matches [Line N, Column M]', () => {
    const m = PATTERNS.LINE_INFO.exec('[Line 42, Column 7]');
    expect(m?.[1]).toBe('42');
    expect(m?.[2]).toBe('7');
  });

  test('LINE_INFO matches [Line N] without column', () => {
    const m = PATTERNS.LINE_INFO.exec('[Line 10]');
    expect(m?.[1]).toBe('10');
    expect(m?.[2]).toBeUndefined();
  });

  test('CALL_MATCH matches Unable to call', () => {
    expect(PATTERNS.CALL_MATCH.exec("Unable to call `myFunc`")?.[1]).toBe('myFunc');
  });

  test('OUTPUT_MATCH matches attempted to output', () => {
    expect(PATTERNS.OUTPUT_MATCH.exec("attempted to output 'data'")?.[1]).toBe('data');
  });
});
