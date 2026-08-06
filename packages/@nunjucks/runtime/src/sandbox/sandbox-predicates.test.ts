import { describe, test, expect } from 'bun:test';
import { resolveSandboxOptions } from './sandbox-options.ts';
import {
  DANGEROUS_OBJECT_INTRINSICS,
  isBlockedSymbol,
  isAllowedKey,
  isBlockedAtScope,
  isInternalKey,
} from './sandbox-predicates.ts';

const nodeOpts = resolveSandboxOptions({ environment: 'node' });

describe('DANGEROUS_OBJECT_INTRINSICS', () => {
  test('contains the prototype-pollution trio', () => {
    expect(DANGEROUS_OBJECT_INTRINSICS.has('__proto__')).toBe(true);
    expect(DANGEROUS_OBJECT_INTRINSICS.has('constructor')).toBe(true);
    expect(DANGEROUS_OBJECT_INTRINSICS.has('prototype')).toBe(true);
  });
});

describe('isBlockedSymbol', () => {
  test('blocks anonymous symbols (no description)', () => {
    expect(isBlockedSymbol(Symbol())).toBe(true);
  });

  test('blocks symbols with a custom description', () => {
    expect(isBlockedSymbol(Symbol('constructor'))).toBe(true);
    expect(isBlockedSymbol(Symbol('anything'))).toBe(true);
  });

  test('allows well-known Symbol.* intrinsics', () => {
    expect(isBlockedSymbol(Symbol.iterator)).toBe(false);
    expect(isBlockedSymbol(Symbol.toStringTag)).toBe(false);
  });
});

describe('isAllowedKey', () => {
  test('allows everything when no allowlist is set', () => {
    expect(isAllowedKey('anything', null)).toBe(true);
    expect(isAllowedKey('anything', undefined)).toBe(true);
    expect(isAllowedKey('anything', [])).toBe(true);
  });

  test('restricts to the allowlist when non-empty', () => {
    expect(isAllowedKey('a', ['a', 'b'])).toBe(true);
    expect(isAllowedKey('c', ['a', 'b'])).toBe(false);
  });
});

describe('isBlockedAtScope', () => {
  test('never blocks symbol keys', () => {
    expect(isBlockedAtScope(Symbol.iterator, nodeOpts, true)).toBe(false);
  });

  test('returns false for keys with no category', () => {
    expect(isBlockedAtScope('safeKey', nodeOpts, true)).toBe(false);
  });

  test('blocks object intrinsics at every level', () => {
    expect(isBlockedAtScope('__proto__', nodeOpts, true)).toBe(true);
    expect(isBlockedAtScope('__proto__', nodeOpts, false)).toBe(true);
    expect(isBlockedAtScope('constructor', nodeOpts, false)).toBe(true);
  });

  test('blocks other categorised keys only at top level', () => {
    expect(isBlockedAtScope('process', nodeOpts, true)).toBe(true);
    expect(isBlockedAtScope('process', nodeOpts, false)).toBe(false);
  });
});

describe('isInternalKey', () => {
  test('recognises nunjucks-internal string keys', () => {
    expect(isInternalKey('__nunjucks')).toBe(true);
    expect(isInternalKey('__nunjucks_frame')).toBe(true);
  });

  test('rejects ordinary string keys', () => {
    expect(isInternalKey('user')).toBe(false);
    expect(isInternalKey('name')).toBe(false);
  });

  test('rejects symbol keys', () => {
    expect(isInternalKey(Symbol('whatever'))).toBe(false);
  });
});
