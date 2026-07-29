import { describe, expect, test } from 'bun:test';
import { validateRenderContext, findContextDangerousValues } from './context.ts';

// biome-ignore lint/security/noGlobalEval: referencing eval as a test fixture for dangerous-function detection
const evalFn: (...args: unknown[]) => unknown = eval;

// `{ __proto__: x }` in an object literal sets the prototype chain, not an own
// enumerable property, so the scanner can't see it. Build a real own property.
const withOwnProto = (): Record<string, unknown> => {
  const obj: Record<string, unknown> = {};
  Object.defineProperty(obj, '__proto__', { value: 1, enumerable: true, configurable: true, writable: true });
  return obj;
};

describe('findContextDangerousValues', () => {
  test('returns empty for a clean context', () => {
    expect(findContextDangerousValues({ name: 'Ada', age: 30 })).toEqual([]);
  });

  test('returns empty for non-object input', () => {
    expect(findContextDangerousValues(null)).toEqual([]);
    expect(findContextDangerousValues(undefined)).toEqual([]);
    expect(findContextDangerousValues('string')).toEqual([]);
  });

  test('flags prototype-pollution keys at the top level', () => {
    expect(findContextDangerousValues(withOwnProto())).toEqual(['__proto__']);
    expect(findContextDangerousValues({ constructor: 1 })).toEqual(['constructor']);
    expect(findContextDangerousValues({ prototype: 1 })).toEqual(['prototype']);
    expect(findContextDangerousValues({ hasOwnProperty: 1 })).toEqual(['hasOwnProperty']);
  });

  test('flags dangerous global names only at the top level', () => {
    const result = findContextDangerousValues({ process: {}, console: {} });
    expect(result).toContain('process');
    expect(result).toContain('console');
  });

  test('does not flag dangerous global names nested below the top level', () => {
    const result = findContextDangerousValues({ wrapper: { process: {} } });
    expect(result).toEqual([]);
  });

  test('flags dangerous function values (eval, Function)', () => {
    const result = findContextDangerousValues({ myEval: evalFn });
    expect(result).toContain('myEval');
  });

  test('flags values that are dangerous references (globalThis, process)', () => {
    const result = findContextDangerousValues({ leaked: globalThis });
    expect(result).toContain('leaked');
  });

  test('respects allowedGlobals keyed on the function name', () => {
    // eval.name === 'eval', so the exemption must list 'eval', not the property key.
    const result = findContextDangerousValues({ myEval: evalFn }, { allowedGlobals: ['eval'] });
    expect(result).toEqual([]);
  });

  test('descends into nested objects and reports dotted paths', () => {
    const result = findContextDangerousValues({ user: { constructor: 1 } });
    expect(result).toEqual(['user.constructor']);
  });

  test('handles cycles without looping forever', () => {
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = { a };
    a.b = b;
    expect(findContextDangerousValues(a)).toEqual([]);
  });
});

describe('validateRenderContext', () => {
  test('is valid when neither strict nor scan is enabled', () => {
    expect(validateRenderContext({ process: 1 }, {})).toEqual({ valid: true, errors: [] });
  });

  test('is valid under strictMode when there are no dangerous values', () => {
    const result = validateRenderContext({ name: 'Ada' }, { strictMode: true });
    expect(result.valid).toBe(true);
  });

  test('is invalid under strictMode when a dangerous value is present', () => {
    const result = validateRenderContext({ constructor: 1 }, { strictMode: true });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('DANGEROUS_CONTEXT_VALUES');
    expect(result.errors[0]?.dangerousPaths).toEqual(['constructor']);
  });

  test('is invalid under scanContextValues when a dangerous value is present', () => {
    const result = validateRenderContext({ leaked: globalThis }, { scanContextValues: true });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.subject).toBe('leaked');
  });
});
