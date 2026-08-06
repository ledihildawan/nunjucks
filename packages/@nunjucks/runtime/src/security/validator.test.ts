import { describe, test, expect } from 'bun:test';
import { createSecurityValidator, validateContext, type ValidateContextOptions } from './validator.ts';

describe('validateContext', () => {
  test('safe context passes', () => {
    expect(validateContext({ name: 'alice' })).toBe(true);
  });

  test('blocks __proto__', () => {
    const obj = Object.create(null);
    obj.__proto__ = {};
    expect(() => validateContext(obj)).toThrow();
  });

  test('blocks constructor', () => {
    expect(() => validateContext({ constructor: 1 })).toThrow();
  });

  test('scanValues flags globalThis', () => {
    const opts: ValidateContextOptions = { scanValues: true };
    expect(() => validateContext({ ref: globalThis }, opts)).toThrow();
  });

  test('scanValues off by default', () => {
    expect(validateContext({ ref: globalThis })).toBe(true);
  });

  test('allowedKeys restricts keys', () => {
    expect(() => validateContext({ a: 1, b: 2 }, { allowedKeys: ['a'] })).toThrow();
  });

  test('blockedKeys blocks specific keys', () => {
    expect(() => validateContext({ secret: 1 }, { blockedKeys: ['secret'] })).toThrow();
  });
});

describe('createSecurityValidator', () => {
  test('strict mode scans values', () => {
    const validator = createSecurityValidator({ strictMode: true });
    expect(() => validator.validateContext({ ref: globalThis })).toThrow();
  });

  test('non-strict mode skips value scan', () => {
    const validator = createSecurityValidator();
    expect(validator.validateContext({ safe: 1 })).toBe(true);
  });

  test('scanTemplate returns violations without throwing', () => {
    const validator = createSecurityValidator();
    const violations = validator.scanTemplate('{{ eval("x") }}');
    expect(violations.length).toBeGreaterThan(0);
  });

  test('scanTemplate throws in strict mode', () => {
    const validator = createSecurityValidator({ strictMode: true });
    expect(() => validator.scanTemplate('{{ eval("x") }}')).toThrow();
  });

  test('exposes options', () => {
    const validator = createSecurityValidator({ allowedKeys: ['a'] });
    expect(validator.options.allowedKeys).toEqual(['a']);
  });
});
