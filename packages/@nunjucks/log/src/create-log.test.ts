import { describe, test, expect } from 'bun:test';
import { createLog } from './create-log.js';

describe('createLog', () => {
  describe('error', () => {
    test('preserves the original error message', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      expect(err.message).toBe('Test error');
      expect(err.lineno).toBe(1);
      expect(err.colno).toBe(0);
    });

    test('preserves metadata needed by downstream formatters', () => {
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

    test('renders one-based source locations when metadata says lineBase is one', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 5,
        colno: 10,
        info: {
          lineBase: 'one',
          templateName: 'test.njk'
        }
      });
      const text = err.output({ format: 'text', verbosity: 'medium' });
      expect(text).toContain('test.njk:5:10');
    });

    test('renders html output', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      const html = err.output({ format: 'html' });
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    test('renders ansi output', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      const ansi = err.output({ format: 'ansi' });
      expect(typeof ansi).toBe('string');
    });

    test('renders text output containing the message', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      const text = err.output({ format: 'text' });
      expect(typeof text).toBe('string');
      expect(text).toContain('Test error');
    });

    test('simple text output omits extra framing', () => {
      const err = createLog('error', {
        message: 'Test error',
        lineno: 1,
        colno: 0
      });
      const text = err.output({ format: 'text', verbosity: 'simple' });
      expect(text).toBe('Test error');
    });

    test('default output exposes all supported formats', () => {
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
    test('preserves the original warning message', () => {
      const warn = createLog('warning', {
        message: 'Test warning',
        lineno: 1,
        colno: 0
      });
      expect(warn.message).toBe('Test warning');
      expect(warn.lineno).toBe(1);
      expect(warn.colno).toBe(0);
    });

    test('preserves warning-specific metadata', () => {
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

    test('renders console output', () => {
      const warn = createLog('warning', {
        message: 'Test warning',
        lineno: 1,
        colno: 0
      });
      const output = warn.output();
      expect(typeof output).toBe('string');
    });

    test('simple warning output shows the warning label', () => {
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

    test('medium warning output shows the warning label', () => {
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

    test('warning output respects one-based location metadata', () => {
      const warn = createLog('warning', {
        message: 'Test warning',
        lineno: 4,
        colno: 0,
        info: {
          varName: 'x',
          templateName: 'test.njk',
          lineBase: 'one'
        }
      });
      const output = warn.output({ verbosity: 'medium' });
      expect(output).toContain('test.njk:4');
    });

    test('full warning output shows rich context', () => {
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

    test('full warning output uses caller-provided version and timestamp', () => {
      const warn = createLog('warning', {
        message: 'Test warning',
        lineno: 1,
        colno: 0,
        info: { varName: 'x' }
      });
      const output = warn.output({
        verbosity: 'full',
        version: '9.9.9',
        timestamp: '2026-07-17T12:00:00.000Z'
      });
      expect(output).toContain('Nunjucks 9.9.9');
      expect(output).toContain('2026-07-17T12:00:00.000Z');
    });
  });

  test('throws for unknown log types', () => {
    expect(() => createLog('unknown', { message: 'test' })).toThrow();
  });

  test('defaults missing info fields to nulls', () => {
    const err = createLog('error', {
      message: 'Test',
      lineno: 0,
      colno: 0
    });
    expect(err.code).toBeNull();
    expect(err.subject).toBeNull();
  });

  test('zero-based metadata is displayed as one-based locations', () => {
    const err = createLog('error', {
      message: 'Test',
      lineno: 1,
      colno: 2,
      info: {
        templateName: 'a.njk',
        lineBase: 'zero'
      }
    });
    const text = err.output({ format: 'text', verbosity: 'medium' });
    expect(text).toContain('a.njk:2:3');
  });
});
