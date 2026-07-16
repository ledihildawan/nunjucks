import { describe, test, expect } from 'bun:test';
import { createLog } from './create-log.js';

describe('createLog', () => {
  describe('error', () => {
    test('membuat error object dengan message', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      expect(err.message).toBe('Test error');
      expect(err.lineno).toBe(1);
      expect(err.colno).toBe(0);
    });

    test('error memiliki properties dari info', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 5,
        colno: 10,
        info: {
          code: 'TEST_CODE',
          subject: 'testSubject',
          phase: 'render',
          templateName: 'test.njk'
        }
      });
      expect(err.code).toBe('TEST_CODE');
      expect(err.subject).toBe('testSubject');
      expect(err.phase).toBe('render');
      expect(err.templateName).toBe('test.njk');
    });

    test('error.output() mengembalikan html string', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      const html = err.output({ format: 'html' });
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    test('error.output() mengembalikan ansi string', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      const ansi = err.output({ format: 'ansi' });
      expect(typeof ansi).toBe('string');
    });

    test('error.output() mengembalikan text string', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      const text = err.output({ format: 'text' });
      expect(typeof text).toBe('string');
      expect(text).toContain('Test error');
    });

    test('error.output() dengan verbosity simple', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      const text = err.output({ format: 'text', verbosity: 'simple' });
      expect(text).toBe('Test error');
    });

    test('error.output() tanpa format mengembalikan semua formats', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      const result = err.output();
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('ansi');
      expect(result).toHaveProperty('text');
    });
  });

  describe('warning', () => {
    test('membuat warning object dengan message', () => {
      const warn = createLog('warning', {
        message: 'Test warning',
        lineno: 1,
        colno: 0
      });
      expect(warn.message).toBe('Test warning');
      expect(warn.lineno).toBe(1);
      expect(warn.colno).toBe(0);
    });

    test('warning memiliki properties dari info', () => {
      const warn = createLog('warning', {
        message: 'Test warning',
        lineno: 5,
        colno: 10,
        info: {
          varName: 'x',
          templateName: 'test.njk',
          undefinedMode: 'strict',
          code: 'UNDEFINED_VARIABLE',
          subject: 'x'
        }
      });
      expect(warn.varName).toBe('x');
      expect(warn.templateName).toBe('test.njk');
      expect(warn.undefinedMode).toBe('strict');
      expect(warn.code).toBe('UNDEFINED_VARIABLE');
      expect(warn.subject).toBe('x');
    });

    test('warning.output() mengembalikan console string', () => {
      const warn = createLog('warning', {
        message: 'Test warning',
        lineno: 1,
        colno: 0
      });
      const output = warn.output();
      expect(typeof output).toBe('string');
    });

    test('warning.output() dengan verbosity simple', () => {
      const warn = createLog('warning', {
        message: 'Test warning',
        lineno: 1,
        colno: 0,
        info: { varName: 'x' }
      });
      const output = warn.output({ verbosity: 'simple' });
      expect(typeof output).toBe('string');
      expect(output).toContain('[WARNING]');
    });

    test('warning.output() dengan verbosity medium', () => {
      const warn = createLog('warning', {
        message: 'Test warning',
        lineno: 1,
        colno: 0,
        info: { varName: 'x' }
      });
      const output = warn.output({ verbosity: 'medium' });
      expect(typeof output).toBe('string');
      expect(output).toContain('[WARNING]');
    });

    test('warning.output() dengan verbosity full', () => {
      const warn = createLog('warning', {
        message: 'Test warning',
        lineno: 1,
        colno: 0,
        info: { varName: 'x', dev: true }
      });
      const output = warn.output({ verbosity: 'full', dev: true });
      expect(typeof output).toBe('string');
      expect(output).toContain('[WARNING]');
      expect(output).toContain('Template Warning');
    });
  });

  test('melemparkan error untuk type yang tidak dikenal', () => {
    expect(() => createLog('unknown', { message: 'test' })).toThrow();
  });

  test('info default ke empty object', () => {
    const err = createLog('error', {
      message: 'Test',
      lineno: 0,
      colno: 0
    });
    expect(err.code).toBeNull();
    expect(err.subject).toBeNull();
  });
});
