import { describe, expect, test } from 'bun:test';
import { CODE_EXECUTION_KEYS, isPrototypeEscapeKey, OBJECT_INTRINSICS } from '@nunjucks/shared';
import {
  DANGEROUS_CALLEES,
  DANGEROUS_PROPERTIES,
  DEFAULT_SECURITY_CONFIG,
  ExpressionSecurityError,
} from './expression-policy.ts';

describe('ExpressionSecurityError', () => {
  test('exposes exactly the three violation flavors', () => {
    expect(Object.keys(ExpressionSecurityError)).toEqual([
      'DYNAMIC_PROPERTY_ACCESS',
      'DANGEROUS_BRACKET_ACCESS',
      'UNSAFE_PROPERTY',
    ]);
  });

  test('each flavor maps to its self-named code', () => {
    for (const [flavor, code] of Object.entries(ExpressionSecurityError)) {
      expect(code).toBe(flavor as typeof code);
    }
  });
});

describe('DEFAULT_SECURITY_CONFIG', () => {
  // WHY: the allow* toggles this config previously declared were never read by any code
  // path and were purged — blockedPropertyPatterns must remain the only policy knob.
  test('declares only the blockedPropertyPatterns knob', () => {
    expect(Object.keys(DEFAULT_SECURITY_CONFIG)).toEqual(['blockedPropertyPatterns']);
  });

  test('ships exactly three default blocked-property patterns', () => {
    expect(DEFAULT_SECURITY_CONFIG.blockedPropertyPatterns).toHaveLength(3);
  });

  describe('pattern accept/reject decisions', () => {
    const { blockedPropertyPatterns } = DEFAULT_SECURITY_CONFIG;
    const patternCases: ReadonlyArray<{ property: string; blocked: boolean }> = [
      // prototype escape and dunder properties — rejected
      { property: '__proto__', blocked: true },
      { property: '__defineGetter__', blocked: true },
      { property: '__lookupSetter__', blocked: true },
      { property: '__secret__', blocked: true },
      { property: 'constructor', blocked: true },
      { property: 'some_constructor', blocked: true },
      { property: 'prototype', blocked: true },
      { property: 'my_prototype', blocked: true },
      // benign lookups — accepted
      { property: 'length', blocked: false },
      { property: 'name', blocked: false },
      { property: 'user', blocked: false },
      { property: 'toStringValue', blocked: false },
      // boundary: anchored suffixes must not catch plurals or substrings
      { property: 'constructors', blocked: false },
      { property: 'prototypes', blocked: false },
      { property: '_proto', blocked: false },
    ];

    patternCases.forEach(({ property, blocked }) => {
      test(`${blocked ? 'blocks' : 'allows'} property '${property}'`, () => {
        expect(blockedPropertyPatterns.some((pattern) => pattern.test(property))).toBe(blocked);
      });
    });
  });
});

describe('DANGEROUS_PROPERTIES', () => {
  test('is a set of strings mirroring OBJECT_INTRINSICS exactly', () => {
    expect(DANGEROUS_PROPERTIES instanceof Set).toBe(true);
    expect([...DANGEROUS_PROPERTIES].sort()).toEqual([...OBJECT_INTRINSICS].sort());
  });

  describe('membership decisions on symbol/property access', () => {
    const propertyCases: ReadonlyArray<{ property: string; blocked: boolean }> = [
      // prototype escape keys — always rejected
      { property: '__proto__', blocked: true },
      { property: 'constructor', blocked: true },
      { property: 'prototype', blocked: true },
      // legacy accessor hooks — rejected
      { property: '__defineGetter__', blocked: true },
      { property: '__defineSetter__', blocked: true },
      { property: '__lookupGetter__', blocked: true },
      { property: '__lookupSetter__', blocked: true },
      // inherited Object members — rejected
      { property: 'hasOwnProperty', blocked: true },
      { property: 'isPrototypeOf', blocked: true },
      { property: 'propertyIsEnumerable', blocked: true },
      { property: 'toString', blocked: true },
      { property: 'toLocaleString', blocked: true },
      { property: 'valueOf', blocked: true },
      // benign data keys — accepted
      { property: 'length', blocked: false },
      { property: 'name', blocked: false },
      { property: 'user', blocked: false },
      { property: 'items', blocked: false },
      // boundary: exact-match membership is case-sensitive and substring-proof
      { property: 'Constructor', blocked: false },
      { property: '__PROTO__', blocked: false },
      { property: 'myConstructor', blocked: false },
      { property: 'proto', blocked: false },
    ];

    propertyCases.forEach(({ property, blocked }) => {
      test(`${blocked ? 'blocks' : 'allows'} '${property}' as a property/symbol name`, () => {
        expect(DANGEROUS_PROPERTIES.has(property)).toBe(blocked);
      });
    });
  });

  test('blocks every key that escapes the prototype chain to code execution', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      expect(isPrototypeEscapeKey(key)).toBe(true);
      expect(DANGEROUS_PROPERTIES.has(key)).toBe(true);
    }
  });
});

describe('DANGEROUS_CALLEES', () => {
  test('is a set of strings mirroring CODE_EXECUTION_KEYS exactly', () => {
    expect(DANGEROUS_CALLEES instanceof Set).toBe(true);
    expect([...DANGEROUS_CALLEES].sort()).toEqual([...CODE_EXECUTION_KEYS].sort());
  });

  describe('membership decisions on callee names', () => {
    const calleeCases: ReadonlyArray<{ callee: string; blocked: boolean }> = [
      // direct code-execution sinks — rejected
      { callee: 'eval', blocked: true },
      { callee: 'Function', blocked: true },
      { callee: 'AsyncFunction', blocked: true },
      { callee: 'GeneratorFunction', blocked: true },
      { callee: 'AsyncGeneratorFunction', blocked: true },
      // timer and process spawning sinks — rejected
      { callee: 'setTimeout', blocked: true },
      { callee: 'setInterval', blocked: true },
      { callee: 'setImmediate', blocked: true },
      { callee: 'requestAnimationFrame', blocked: true },
      { callee: 'queueMicrotask', blocked: true },
      { callee: 'exec', blocked: true },
      { callee: 'execFile', blocked: true },
      { callee: 'execSync', blocked: true },
      { callee: 'spawn', blocked: true },
      { callee: 'spawnSync', blocked: true },
      { callee: 'fork', blocked: true },
      // network/module sinks — rejected
      { callee: 'fetch', blocked: true },
      { callee: 'XMLHttpRequest', blocked: true },
      { callee: 'WebSocket', blocked: true },
      { callee: 'Worker', blocked: true },
      { callee: 'WebAssembly', blocked: true },
      { callee: 'import', blocked: true },
      { callee: 'importScripts', blocked: true },
      // benign helpers — accepted
      { callee: 'greet', blocked: false },
      { callee: 'upper', blocked: false },
      { callee: 'join', blocked: false },
      { callee: 'console', blocked: false },
      { callee: 'print', blocked: false },
      // boundary: exact-match membership is case-sensitive and substring-proof
      { callee: 'Eval', blocked: false },
      { callee: 'evaluate', blocked: false },
      { callee: 'settimeout', blocked: false },
    ];

    calleeCases.forEach(({ callee, blocked }) => {
      test(`${blocked ? 'rejects' : 'accepts'} '${callee}' in call position`, () => {
        expect(DANGEROUS_CALLEES.has(callee)).toBe(blocked);
      });
    });
  });

  // WHY: the canonical reachable-global/execution-vector pair — if either ever drops out of
  // the callee blocklist, every expression validator silently stops rejecting it.
  test('always covers eval and Function', () => {
    expect(DANGEROUS_CALLEES.has('eval')).toBe(true);
    expect(DANGEROUS_CALLEES.has('Function')).toBe(true);
  });

  test('stays disjoint from DANGEROUS_PROPERTIES so each list keeps its role', () => {
    for (const callee of DANGEROUS_CALLEES) {
      expect(DANGEROUS_PROPERTIES.has(callee)).toBe(false);
    }
  });
});
