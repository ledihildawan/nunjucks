import { describe, test, expect } from 'bun:test';
import { isTemplateError } from '../branding.ts';
import { createSecurityError, isSecurityError } from './security.ts';

describe('createSecurityError', () => {
  test('uses default code SECURITY_VIOLATION and the given message', () => {
    const err = createSecurityError('boom');
    expect(err.message).toBe('boom');
    expect(err.code).toBe('SECURITY_VIOLATION');
  });

  test('accepts a custom code', () => {
    expect(createSecurityError('boom', 'CUSTOM').code).toBe('CUSTOM');
  });

  test('is an Error instance with name SecurityError', () => {
    const err = createSecurityError('x');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('SecurityError');
  });

  test('applies TemplateError structural defaults', () => {
    const err = createSecurityError('x');
    expect(err.lineno).toBeNull();
    expect(err.colno).toBeNull();
    expect(err.subject).toBeNull();
    expect(err.phase).toBe('render');
    expect(err.templateName).toBeNull();
    expect(err.templatePath).toBeNull();
  });

  test('carries the TEMPLATE_ERROR marker so isTemplateError recognises it', () => {
    expect(isTemplateError(createSecurityError('x'))).toBe(true);
  });
});

describe('isSecurityError', () => {
  test('recognises factory output', () => {
    expect(isSecurityError(createSecurityError('x'))).toBe(true);
  });

  test('rejects plain Error, null, and non-errors', () => {
    expect(isSecurityError(new Error('x'))).toBe(false);
    expect(isSecurityError(null)).toBe(false);
    expect(isSecurityError(undefined)).toBe(false);
    expect(isSecurityError({})).toBe(false);
    expect(isSecurityError('SecurityError')).toBe(false);
  });

  test('narrows to SecurityError (type guard)', () => {
    const value: unknown = createSecurityError('x', 'CODE_X');
    if (isSecurityError(value)) {
      expect(value.code).toBe('CODE_X');
    } else {
      throw new Error('expected narrowing to SecurityError');
    }
  });
});