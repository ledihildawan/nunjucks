import { describe, test, expect } from 'bun:test';
import {
  createSecurityError,
  isSecurityError,
  type SecurityError,
  scanTemplateForDangerousCode,
  validateContextKeys,
  validateContext,
  findDangerousValues,
  scrubDangerousReferences,
  isDangerousReference,
  restrictGlobals,
  createSecurityValidator,
} from './security.ts';
import process from "node:process";

describe('SecurityError', () => {
  test('uses default code SECURITY_VIOLATION', () => {
    const err = createSecurityError('boom');
    expect(err.name).toBe('SecurityError');
    expect(err.code).toBe('SECURITY_VIOLATION');
    expect(err.message).toBe('boom');
    expect(err).toBeInstanceOf(Error);
  });

  test('accepts a custom code', () => {
    const err = createSecurityError('boom', 'CUSTOM');
    expect(err.code).toBe('CUSTOM');
  });

  test('isSecurityError recognises the factory output', () => {
    expect(isSecurityError(createSecurityError('x'))).toBe(true);
    expect(isSecurityError(new Error('x'))).toBe(false);
    expect(isSecurityError(null)).toBe(false);
  });
});

describe('scanTemplateForDangerousCode', () => {
  test('returns no violations for clean template', () => {
    expect(scanTemplateForDangerousCode('{{ name }}')).toEqual([]);
  });

  test('detects eval()', () => {
    const violations = scanTemplateForDangerousCode('{{ eval("x") }}');
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toBe('eval() is not allowed');
    expect(violations[0]!.name).toBe('eval');
  });

  test('detects Function()', () => {
    const violations = scanTemplateForDangerousCode('{{ Function("x") }}');
    expect(violations).toHaveLength(1);
    expect(violations[0]!.name).toBe('Function');
  });

  test('detects require()', () => {
    const violations = scanTemplateForDangerousCode('{{ require("fs") }}');
    expect(violations).toHaveLength(1);
    expect(violations[0]!.name).toBe('require');
  });

  test('detects dynamic import()', () => {
    const violations = scanTemplateForDangerousCode('{{ import ("fs") }}');
    expect(violations).toHaveLength(1);
    expect(violations[0]!.name).toBe('import');
  });

  test('reports multiple violations', () => {
    const violations = scanTemplateForDangerousCode('{{ eval("a") }}{{ require("b") }}');
    expect(violations).toHaveLength(2);
  });

  test('reports 1-based line and 0-based column', () => {
    const violations = scanTemplateForDangerousCode('line1\neval()');
    expect(violations[0]!.line).toBe(2);
    expect(violations[0]!.col).toBe(0);
  });
});

describe('validateContextKeys', () => {
  test('non-object values are valid', () => {
    for (const v of [null, undefined, 42, 's', true]) {
      expect(validateContextKeys(v)).toEqual({ valid: true, blocked: [] });
    }
  });

  test('arrays are valid', () => {
    expect(validateContextKeys([1, 2]).valid).toBe(true);
  });

  test('functions are valid', () => {
    expect(validateContextKeys(() => 1).valid).toBe(true);
  });

  test('flags blocked intrinsic keys', () => {
    const obj = Object.create(null);
    obj.__proto__ = {};
    obj.name = 'x';
    const result = validateContextKeys(obj);
    expect(result.valid).toBe(false);
    expect(result.blocked.map((b) => b.key)).toContain('__proto__');
  });

  test('flags keys not in allowedKeys', () => {
    const result = validateContextKeys({ a: 1, b: 2 }, ['a']);
    expect(result.valid).toBe(false);
    expect(result.blocked.map((b) => b.reason)).toContain('not in allowed keys');
  });

  test('flags keys in blockedKeys list', () => {
    const result = validateContextKeys({ secret: 1 }, null, ['secret']);
    expect(result.valid).toBe(false);
    expect(result.blocked[0]!.reason).toBe('in blocked keys list');
  });

  test('clean context is valid', () => {
    expect(validateContextKeys({ name: 'x', age: 3 }).valid).toBe(true);
  });
});

describe('validateContext', () => {
  test('returns true for a safe context', () => {
    expect(validateContext({ name: 'alice' })).toBe(true);
  });

  test('throws BLOCKED_CONTEXT_KEYS for blocked keys', () => {
    try {
      validateContext({ process: 1 });
      throw new Error('expected validateContext to throw');
    } catch (e) {
      expect(isSecurityError(e)).toBe(true);
      expect((e as SecurityError).code).toBe('BLOCKED_CONTEXT_KEYS');
      expect((e as SecurityError & { dangerousPaths: string[] }).dangerousPaths).toContain('process');
    }
  });

  test('throws DANGEROUS_CONTEXT_VALUES when scanValues finds dangerous references', () => {
    try {
      validateContext({ myRef: globalThis }, { scanValues: true });
      throw new Error('expected validateContext to throw');
    } catch (e) {
      expect((e as SecurityError).code).toBe('DANGEROUS_CONTEXT_VALUES');
      expect((e as SecurityError & { dangerousPaths: string[] }).dangerousPaths).toContain('myRef');
    }
  });

  test('does not scan values by default', () => {
    expect(validateContext({ myRef: globalThis })).toBe(true);
  });
});

describe('findDangerousValues', () => {
  test('returns empty for a safe object', () => {
    expect(findDangerousValues({ name: 'alice', age: 3 })).toEqual([]);
  });
  test('flags prototype-pollution keys at top level', () => {
    const protoObj = Object.create(null);
    protoObj.__proto__ = {};
    expect(findDangerousValues(protoObj)).toContain('__proto__');
    expect(findDangerousValues({ constructor: 1 })).toContain('constructor');
  });

  test('flags object-intrinsic keys at nested levels', () => {
    expect(findDangerousValues({ nested: { toString: 'x' } })).toContain('nested.toString');
  });

  test('flags dangerous global keys only at top level', () => {
    expect(findDangerousValues({ process: 1 })).toContain('process');
    expect(findDangerousValues({ nested: { process: 1 } })).toEqual([]);
  });

  test('flags dangerous references anywhere', () => {
    expect(findDangerousValues({ root: { ref: globalThis } })).toContain('root.ref');
  });

  test('flags top-level eval/Function function values', () => {
    const result = findDangerousValues({ eval });
    expect(result).toContain('eval');
  });

  test('handles circular references without looping', () => {
    const obj: Record<string, unknown> = { name: 'x' };
    obj.ref = obj;
    expect(findDangerousValues(obj)).toEqual([]);
  });

  test('respects allowedGlobals for non-builtin functions at top level', () => {
    const myFn = function customFn() { return 1; };
    expect(findDangerousValues({ myFn }, ['customFn'])).toEqual([]);
    expect(findDangerousValues({ myFn }, [])).toContain('myFn');
  });
});

describe('isDangerousReference', () => {
  test('identifies process and globalThis as dangerous', () => {
    expect(isDangerousReference(process)).toBe(true);
    expect(isDangerousReference(globalThis)).toBe(true);
  });

  test('returns false for null/undefined/primitives', () => {
    expect(isDangerousReference(null)).toBe(false);
    expect(isDangerousReference(undefined)).toBe(false);
    expect(isDangerousReference(42)).toBe(false);
    expect(isDangerousReference('s')).toBe(false);
  });

  test('returns false for plain objects', () => {
    expect(isDangerousReference({})).toBe(false);
    expect(isDangerousReference([])).toBe(false);
  });
});

describe('scrubDangerousReferences', () => {
  test('removes dangerous reference values in place', () => {
    const ctx = { a: 1, b: globalThis, c: 'x' } as Record<string, unknown>;
    const result = scrubDangerousReferences(ctx, null) as Record<string, unknown>;
    expect(result.a).toBe(1);
    expect(result.c).toBe('x');
    expect('b' in result).toBe(false);
  });

  test('recurses into nested objects', () => {
    const ctx = { nested: { safe: 1, danger: globalThis } } as { nested: Record<string, unknown> };
    scrubDangerousReferences(ctx, null);
    expect(ctx.nested.safe).toBe(1);
    expect('danger' in ctx.nested).toBe(false);
  });

  test('leaves safe values untouched and returns the same root object', () => {
    const ctx = { a: 1 };
    expect(scrubDangerousReferences(ctx, null)).toBe(ctx);
  });
});

describe('restrictGlobals', () => {
  test('removes dangerous globals not in the allow list', () => {
    const restricted = restrictGlobals({ name: 'x', process: 1, eval: 1 }, []);
    expect(restricted).toEqual({ name: 'x' });
  });

  test('keeps allowed globals', () => {
    const restricted = restrictGlobals({ name: 'x', process: 1 }, ['process']);
    expect(restricted).toEqual({ name: 'x', process: 1 });
  });
});

describe('createSecurityValidator', () => {
  test('validateContext delegates to validateContext options', () => {
    const validator = createSecurityValidator({ blockedKeys: ['secret'] });
    expect(validator.validateContext({ name: 'x' })).toBe(true);
    try {
      validator.validateContext({ secret: 1 });
      throw new Error('expected validateContext to throw');
    } catch (e) {
      expect(isSecurityError(e)).toBe(true);
    }
  });

  test('scanTemplate returns violations without throwing in non-strict mode', () => {
    const validator = createSecurityValidator();
    const violations = validator.scanTemplate('eval()');
    expect(violations).toHaveLength(1);
  });

  test('scanTemplate throws in strict mode when violations exist', () => {
    const validator = createSecurityValidator({ strictMode: true });
    expect(() => validator.scanTemplate('eval()')).toThrow();
    try {
      validator.scanTemplate('eval()');
    } catch (e) {
      expect((e as SecurityError).code).toBe('DANGEROUS_TEMPLATE_CODE');
    }
  });

  test('strict mode enables value scanning with no allowed globals', () => {
    const validator = createSecurityValidator({ strictMode: true });
    try {
      validator.validateContext({ myRef: globalThis });
      throw new Error('expected validateContext to throw');
    } catch (e) {
      expect(isSecurityError(e)).toBe(true);
    }
  });

  test('exposes options on the returned validator', () => {
    const validator = createSecurityValidator({ allowedKeys: ['a'] });
    expect(validator.options.allowedKeys).toEqual(['a']);
  });
});
