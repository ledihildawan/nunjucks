import { describe, expect, test } from 'bun:test';
import { resolveSandboxOptions } from './sandbox-options.ts';
import {
  DANGEROUS_OBJECT_INTRINSICS,
  isAllowedKey,
  isBlockedAtScope,
  isBlockedSymbol,
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
  test('allows everything when no allowlist is configured', () => {
    expect(isAllowedKey('anything', null)).toBe(true);
    expect(isAllowedKey('anything', undefined)).toBe(true);
  });

  test('denies all keys for an empty allowlist (fail-closed deny-all)', () => {
    expect(isAllowedKey('anything', [])).toBe(false);
  });

  test('restricts to the allowlist when non-empty', () => {
    expect(isAllowedKey('a', ['a', 'b'])).toBe(true);
    expect(isAllowedKey('c', ['a', 'b'])).toBe(false);
  });
});

describe('isBlockedAtScope', () => {
  test('never blocks symbol keys', () => {
    expect(
      isBlockedAtScope({ key: Symbol.iterator, sandboxOptions: nodeOpts, topLevel: true })
    ).toBe(false);
  });

  test('returns false for keys with no category', () => {
    expect(isBlockedAtScope({ key: 'safeKey', sandboxOptions: nodeOpts, topLevel: true })).toBe(
      false
    );
  });

  test('blocks object intrinsics at every level', () => {
    expect(isBlockedAtScope({ key: '__proto__', sandboxOptions: nodeOpts, topLevel: true })).toBe(
      true
    );
    expect(isBlockedAtScope({ key: '__proto__', sandboxOptions: nodeOpts, topLevel: false })).toBe(
      true
    );
    expect(
      isBlockedAtScope({ key: 'constructor', sandboxOptions: nodeOpts, topLevel: false })
    ).toBe(true);
  });

  test('blocks other categorised keys only at top level', () => {
    expect(isBlockedAtScope({ key: 'process', sandboxOptions: nodeOpts, topLevel: true })).toBe(
      true
    );
    expect(isBlockedAtScope({ key: 'process', sandboxOptions: nodeOpts, topLevel: false })).toBe(
      false
    );
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
