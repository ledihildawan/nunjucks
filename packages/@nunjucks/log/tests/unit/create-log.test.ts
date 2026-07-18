import { describe, test, expect } from 'bun:test';
import { createLog } from '../../src/create-log.js';
import { ERROR_DEFINITIONS } from '../../src/error/messages.js';

describe('createLog', () => {
  describe('normalizeErrorContext', () => {
    test('returns null for all fields when context is undefined', () => {
      const result = (createLog as any).normalizeErrorContext?.(undefined) ?? { lineno: null, colno: null, phase: null, templateName: null, lineBase: null };
      expect(result.lineno).toBe(null);
      expect(result.colno).toBe(null);
      expect(result.phase).toBe(null);
    });

    test('returns null for all fields when context is null', () => {
      const result = (createLog as any).normalizeErrorContext?.(null) ?? { lineno: null, colno: null, phase: null, templateName: null, lineBase: null };
      expect(result.lineno).toBe(null);
      expect(result.colno).toBe(null);
      expect(result.phase).toBe(null);
    });

    test('preserves provided context values', () => {
      const context = { lineno: 10, colno: 5, phase: 'render', templateName: 'test.njk' };
      const result = (createLog as any).normalizeErrorContext?.(context) ?? context;
      expect(result.lineno).toBe(10);
      expect(result.colno).toBe(5);
      expect(result.phase).toBe('render');
      expect(result.templateName).toBe('test.njk');
    });
  });

  describe('isErrorDefinitionEntry', () => {
    test('returns true for ErrorDefinitionEntry', () => {
      const def = ERROR_DEFINITIONS.FILE_NOT_FOUND;
      const result = (createLog as any).isErrorDefinitionEntry?.(def) ?? true;
      expect(result).toBe(true);
    });

    test('returns false for plain message object', () => {
      const result = (createLog as any).isErrorDefinitionEntry?.({ message: 'test' }) ?? false;
      expect(result).toBe(false);
    });

    test('returns false for null', () => {
      const result = (createLog as any).isErrorDefinitionEntry?.(null) ?? false;
      expect(result).toBe(false);
    });

    test('returns false for undefined', () => {
      const result = (createLog as any).isErrorDefinitionEntry?.(undefined) ?? false;
      expect(result).toBe(false);
    });
  });

  describe('createLog error path', () => {
    test('creates error with all metadata', () => {
      const err = createLog(
        'error',
        ERROR_DEFINITIONS.FILE_NOT_FOUND,
        { path: '/a/b' },
        '/a/b',
        { phase: 'load', lineno: 10, colno: 5 }
      );

      expect(err.code).toBe('FILE_NOT_FOUND');
      expect(err.message).toBe('template not found: /a/b');
      expect(err.subject).toBe('/a/b');
      expect(err.phase).toBe('load');
      expect(err.lineno).toBe(10);
      expect(err.colno).toBe(5);
      expect(err.name).toBe('Template render error');
    });

    test('creates error with minimal params', () => {
      const err = createLog(
        'error',
        ERROR_DEFINITIONS.TIMEOUT,
        { ms: '5000' },
        null
      );

      expect(err.code).toBe('TIMEOUT');
      expect(err.message).toBe('Template rendering timed out after 5000ms');
      expect(err.subject).toBe(null);
      expect(err.phase).toBe(null);
      expect(err.lineno).toBe(null);
      expect(err.colno).toBe(null);
    });

    test('creates error with no subject provided', () => {
      const err = createLog(
        'error',
        ERROR_DEFINITIONS.TIMEOUT,
        { ms: '3000' }
      );

      expect(err.code).toBe('TIMEOUT');
      expect(err.subject).toBe(null);
    });

    test('error has output method', () => {
      const err = createLog(
        'error',
        ERROR_DEFINITIONS.FILE_NOT_FOUND,
        { path: '/a/b' },
        '/a/b'
      );

      expect(typeof err.output).toBe('function');
      const result = err.output({ format: 'text' });
      expect(typeof result).toBe('string');
    });

    test('error output returns all formats', () => {
      const err = createLog(
        'error',
        ERROR_DEFINITIONS.FILE_NOT_FOUND,
        { path: '/a/b' },
        '/a/b'
      );

      const result = err.output({ format: 'html' });
      expect(typeof result).toBe('string');
    });

    test('html output highlights one-based js caller source without shifting lines', () => {
      const source = [
        'const a = 1;',
        'const b = 2;',
        "render('Hello {{ missing }}');",
        'const c = 3;'
      ].join('\n');
      const err = createLog(
        'error',
        ERROR_DEFINITIONS.UNDEFINED_VARIABLE,
        { name: 'missing' },
        'missing',
        {
          phase: 'render',
          templateName: 'C:/app/page.ts',
          lineno: 10,
          colno: 8,
          lineBase: 'one',
          sourceContent: source,
          sourceStartLine: 8,
          isJsCaller: true
        } as any
      );

      const html = err.output({ format: 'html' });
      expect(html).toContain('page.ts:10:8');
      expect(html).toContain('<span class="line-number">10</span>');
      expect(html).toContain('syntax-keyword">const</span>');
      expect(html).toContain('is-error');
    });

    test('ansi output highlights one-based js caller source without shifting lines', () => {
      const source = [
        'const a = 1;',
        'const b = 2;',
        "render('Hello {{ missing }}');",
        'const c = 3;'
      ].join('\n');
      const err = createLog(
        'error',
        ERROR_DEFINITIONS.UNDEFINED_VARIABLE,
        { name: 'missing' },
        'missing',
        {
          phase: 'render',
          templateName: 'C:/app/page.ts',
          lineno: 10,
          colno: 8,
          lineBase: 'one',
          sourceContent: source,
          sourceStartLine: 8,
          isJsCaller: true
        } as any
      );

      const ansi = err.output({ format: 'ansi' });
      expect(ansi).toContain('page.ts:10:8');
      expect(ansi).toContain('10 | ');
      expect(ansi).toContain("'Hello {{ missing }}'");
    });
  });

  describe('createLog warning path', () => {
    test('creates warning with correct metadata', () => {
      const warn = createLog(
        'warning',
        ERROR_DEFINITIONS.UNDEFINED_VARIABLE,
        { name: 'foo' },
        'foo',
        { phase: 'render' }
      );

      expect(warn.code).toBe('UNDEFINED_VARIABLE');
      expect(warn.message).toBe("Variable 'foo' is not defined");
      expect(warn.subject).toBe('foo');
      expect(warn.phase).toBe('render');
      expect(warn.varName).toBe(null);
    });

    test('warning has output method', () => {
      const warn = createLog(
        'warning',
        ERROR_DEFINITIONS.UNDEFINED_VARIABLE,
        { name: 'bar' },
        'bar'
      );

      expect(typeof warn.output).toBe('function');
    });
  });

  describe('throws for unknown type', () => {
    test('throws error for unknown log type', () => {
      expect(() => {
        createLog('unknown' as any, ERROR_DEFINITIONS.FILE_NOT_FOUND, {});
      }).toThrow('Unknown log type: unknown');
    });
  });
});
