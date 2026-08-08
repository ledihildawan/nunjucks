import { describe, test, expect } from 'bun:test';
import { resolveLocation } from './error-location.ts';

describe('resolveLocation', () => {
  describe('precedence: caller wins over template coords', () => {
    test('explicit jsCaller is used when both template coords and caller are present', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        jsCaller: '/path/to/caller.ts',
        jsCallerErrorLine: 10,
        jsCallerErrorCol: 5,
        errLineno: 0,
        errColno: 3
      });
      expect(result.preferCallerLocation).toBe(true);
      expect(result.lineBase).toBe('one');
      expect(result.lineno).toBe(10);
      expect(result.colno).toBe(5);
    });

    test('auto-detected _callerFile is used for inline templates', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        _callerFile: '/path/to/caller.ts',
        _callerLocation: { lineNumber: 25, columnNumber: 18 },
        errLineno: 0,
        errColno: 3
      });
      expect(result.preferCallerLocation).toBe(true);
      expect(result.lineBase).toBe('one');
      expect(result.lineno).toBe(25);
      expect(result.colno).toBe(18);
    });

    test('caller is ignored when templatePath is set', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        templatePath: '/path/to/template.njk',
        _callerFile: '/path/to/caller.ts',
        _callerLocation: { lineNumber: 25, columnNumber: 18 },
        errLineno: 5,
        errColno: 3
      });
      expect(result.preferCallerLocation).toBe(false);
      expect(result.lineBase).toBe('zero');
      expect(result.lineno).toBe(5);
      expect(result.colno).toBe(3);
    });
  });

  describe('precedence: template coords when no caller', () => {
    test('uses errLineno/errColno with lineBase zero', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        errLineno: 7,
        errColno: 4
      });
      expect(result.preferCallerLocation).toBe(false);
      expect(result.lineBase).toBe('zero');
      expect(result.lineno).toBe(7);
      expect(result.colno).toBe(4);
    });

    test('falls back to config.lineno/colno when errLineno is null', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        lineno: 100,
        colno: 50
      });
      expect(result.lineno).toBe(100);
      expect(result.colno).toBe(50);
      expect(result.lineBase).toBe('zero');
    });

    test('null fallback when nothing is known', async () => {
      const result = await resolveLocation({});
      expect(result.lineno).toBeNull();
      expect(result.colno).toBeNull();
    });
  });

  describe('template-in-caller matching', () => {
    test('finds template in caller file and remaps col from template-relative to caller-relative', async () => {
      const result = await resolveLocation({
        template: '{{ user.name }}',
        _callerFile: '/virtual/path',
        _callerLocation: { lineNumber: 4, columnNumber: 1 },
        errLineno: 0,
        errColno: 10
      });

      expect(result.preferCallerLocation).toBe(true);
      expect(result.lineBase).toBe('one');
      expect(result.lineno).toBe(4);
    });
  });

  describe('jsCaller fallback to auto-caller', () => {
    test('explicit jsCaller takes precedence over auto-detected _callerFile', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        jsCaller: '/explicit.ts',
        jsCallerErrorLine: 1,
        jsCallerErrorCol: 1,
        _callerFile: '/auto.ts',
        _callerLocation: { lineNumber: 99, columnNumber: 99 },
        errLineno: 0,
        errColno: 3
      });
      expect(result.templatePath).toBe('/explicit.ts');
      expect(result.lineno).toBe(1);
    });
  });

  describe('edge cases', () => {
    test('jsCallerErrorLine null with jsCaller set -> neither caller branch applies, falls through to template coords', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        jsCaller: '/explicit.ts',
        jsCallerErrorLine: null,
        _callerFile: '/auto.ts',
        _callerLocation: { lineNumber: 42, columnNumber: 7 },
        errLineno: 0,
        errColno: 3
      });
      expect(result.preferCallerLocation).toBe(false);
      expect(result.lineBase).toBe('zero');
      expect(result.lineno).toBe(0);
      expect(result.colno).toBe(3);
    });

    test('_callerFile = "unknown" is treated as no caller', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        _callerFile: 'unknown',
        _callerLocation: { lineNumber: 5, columnNumber: 5 },
        errLineno: 0,
        errColno: 3
      });
      expect(result.preferCallerLocation).toBe(false);
      expect(result.lineno).toBe(0);
      expect(result.colno).toBe(3);
    });

    test('partial caller location (line only, no col) still enables caller preference', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        _callerFile: '/auto.ts',
        _callerLocation: { lineNumber: 10, columnNumber: null },
        errLineno: 0,
        errColno: 3
      });
      expect(result.preferCallerLocation).toBe(true);
    });
  });
});