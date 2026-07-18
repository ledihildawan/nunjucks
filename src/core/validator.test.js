import { describe, test, expect } from 'bun:test';
import { findContextDangerousValues, validateRenderContext } from './validator.js';

describe('findContextDangerousValues', () => {
  test('flags process inside nested values', () => {
    const paths = findContextDangerousValues({ user: { global: process } });
    expect(paths).toContain('user.global');
  });

  test('flags globalThis at any depth', () => {
    const paths = findContextDangerousValues({ a: globalThis, b: { nested: { deep: globalThis } } });
    expect(paths).toContain('a');
    expect(paths).toContain('b.nested.deep');
  });

  test('returns empty when no dangerous references', () => {
    const paths = findContextDangerousValues({ user: { name: 'Ada' }, items: [1, 2, 3] });
    expect(paths).toEqual([]);
  });

  test('flags Buffer instances', () => {
    if (typeof Buffer === 'undefined') return;
    const paths = findContextDangerousValues({ token: Buffer.from('secret') });
    expect(paths).toContain('token');
  });
});

describe('validateRenderContext strict mode', () => {
  test('throws DANGEROUS_CONTEXT_VALUES when contextStrict is error and process is nested', () => {
    const paths = findContextDangerousValues({ user: { global: process } });
    expect(paths).toContain('user.global');
  });

  test('passes silently when contextStrict is false and dev is false', () => {
    const result = validateRenderContext({ user: { name: 'Ada' } }, { contextStrict: false, dev: false });
    expect(result.valid).toBe(true);
  });
});
