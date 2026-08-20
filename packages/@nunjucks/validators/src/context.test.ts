import { describe, expect, test } from 'bun:test';
import process from 'node:process';
import { ERROR_CODES } from '@nunjucks/error-catalog';
import { isErr, isOk } from '@nunjucks/lib';
import { findContextDangerousValues, validateRenderContext } from '@nunjucks/validators';

describe('findContextDangerousValues', () => {
  test('flags process inside nested values', () => {
    const paths = findContextDangerousValues({ user: { global: process } });
    expect(paths).toContain('user.global');
  });

  test('flags globalThis at any depth', () => {
    const paths = findContextDangerousValues({
      a: globalThis,
      b: { nested: { deep: globalThis } },
    });
    expect(paths).toContain('a');
    expect(paths).toContain('b.nested.deep');
  });

  test('returns empty when no dangerous references', () => {
    const paths = findContextDangerousValues({ user: { name: 'Ada' }, items: [1, 2, 3] });
    expect(paths).toEqual([]);
  });

  test('flags Buffer instances', () => {
    const paths = findContextDangerousValues({ token: Buffer.from('secret') });
    expect(paths).toContain('token');
  });
});

describe('validateRenderContext strict mode', () => {
  test('returns Err DANGEROUS_CONTEXT_VALUES with dangerousPaths when strictMode and process is nested', () => {
    const result = validateRenderContext({ user: { global: process } }, { strictMode: true });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0].code).toBe(ERROR_CODES.DANGEROUS_CONTEXT_VALUES);
      expect(result.error[0].dangerousPaths).toContain('user.global');
    }
  });

  test('passes silently when strictMode is false', () => {
    const result = validateRenderContext({ user: { name: 'Ada' } }, { strictMode: false });
    expect(isOk(result)).toBe(true);
  });
});
