import { describe, test, expect } from 'bun:test';
import { createWarning, createUndefinedWarning } from './create-warning.js';

describe('createWarning', () => {
  test('creates warning with required fields', () => {
    const warning = createWarning('Test message', 1, 5);
    expect(warning.message).toBe('Test message');
    expect(warning.lineno).toBe(1);
    expect(warning.colno).toBe(5);
    expect(warning.varName).toBeNull();
    expect(warning.templateName).toBeNull();
    expect(warning.undefinedMode).toBe('chainable');
    expect(warning.code).toBeNull();
    expect(warning.subject).toBeNull();
  });

  test('creates warning with optional info', () => {
    const warning = createWarning('Test message', 1, 5, {
      varName: 'user',
      templateName: 'index.html',
      undefinedMode: 'strict',
      code: 'TEST_CODE',
      subject: 'user'
    });
    expect(warning.message).toBe('Test message');
    expect(warning.varName).toBe('user');
    expect(warning.templateName).toBe('index.html');
    expect(warning.undefinedMode).toBe('strict');
    expect(warning.code).toBe('TEST_CODE');
    expect(warning.subject).toBe('user');
  });
});

describe('createUndefinedWarning', () => {
  test('creates warning with varName', () => {
    const warning = createUndefinedWarning('user', 5, 10, 'template.html', 'strict');
    expect(warning.message).toBe("Variable 'user' is undefined or null");
    expect(warning.lineno).toBe(5);
    expect(warning.colno).toBe(10);
    expect(warning.varName).toBe('user');
    expect(warning.templateName).toBe('template.html');
    expect(warning.undefinedMode).toBe('strict');
    expect(warning.code).toBe('UNDEFINED_VARIABLE');
    expect(warning.subject).toBe('user');
  });

  test('creates warning without varName', () => {
    const warning = createUndefinedWarning(null, 5, 10, 'template.html', 'debug');
    expect(warning.message).toBe('Variable is undefined or null');
    expect(warning.lineno).toBe(5);
    expect(warning.colno).toBe(10);
    expect(warning.varName).toBeNull();
    expect(warning.templateName).toBe('template.html');
    expect(warning.undefinedMode).toBe('debug');
    expect(warning.code).toBe('UNDEFINED_VALUE');
    expect(warning.subject).toBeNull();
  });

  test('creates warning with undefined varName', () => {
    const warning = createUndefinedWarning(undefined, 3, 7, 'test.njk', 'chainable');
    expect(warning.message).toBe('Variable is undefined or null');
    expect(warning.varName).toBeNull();
    expect(warning.code).toBe('UNDEFINED_VALUE');
  });
});
