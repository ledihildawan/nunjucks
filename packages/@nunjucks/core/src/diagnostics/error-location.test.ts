import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
        errColno: 3,
      });
      expect(result.preferCallerLocation).toBe(true);
      expect(result.lineBase).toBe('one');
      expect(result.lineno).toBe(10);
      expect(result.colno).toBe(5);
    });

    test('auto-detected callerFile is used for inline templates', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        callerFile: '/path/to/caller.ts',
        callerLocation: { lineNumber: 25, columnNumber: 18 },
        errLineno: 0,
        errColno: 3,
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
        callerFile: '/path/to/caller.ts',
        callerLocation: { lineNumber: 25, columnNumber: 18 },
        errLineno: 5,
        errColno: 3,
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
        errColno: 4,
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
        colno: 50,
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
        callerFile: '/virtual/path',
        callerLocation: { lineNumber: 4, columnNumber: 1 },
        errLineno: 0,
        errColno: 10,
      });

      expect(result.preferCallerLocation).toBe(true);
      expect(result.lineBase).toBe('one');
      expect(result.lineno).toBe(4);
    });
  });

  describe('jsCaller fallback to auto-caller', () => {
    test('explicit jsCaller takes precedence over auto-detected callerFile', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        jsCaller: '/explicit.ts',
        jsCallerErrorLine: 1,
        jsCallerErrorCol: 1,
        callerFile: '/auto.ts',
        callerLocation: { lineNumber: 99, columnNumber: 99 },
        errLineno: 0,
        errColno: 3,
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
        callerFile: '/auto.ts',
        callerLocation: { lineNumber: 42, columnNumber: 7 },
        errLineno: 0,
        errColno: 3,
      });
      expect(result.preferCallerLocation).toBe(false);
      expect(result.lineBase).toBe('zero');
      expect(result.lineno).toBe(0);
      expect(result.colno).toBe(3);
    });

    test('callerFile = "unknown" is treated as no caller', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        callerFile: 'unknown',
        callerLocation: { lineNumber: 5, columnNumber: 5 },
        errLineno: 0,
        errColno: 3,
      });
      expect(result.preferCallerLocation).toBe(false);
      expect(result.lineno).toBe(0);
      expect(result.colno).toBe(3);
    });

    test('partial caller location (line only, no col) still enables caller preference', async () => {
      const result = await resolveLocation({
        template: '{{ foo }}',
        callerFile: '/auto.ts',
        callerLocation: { lineNumber: 10, columnNumber: null },
        errLineno: 0,
        errColno: 3,
      });
      expect(result.preferCallerLocation).toBe(true);
    });
  });

  describe('wrapper scenario: readable caller file without the template literal', () => {
    let wrapperPath: string;
    let callerPath: string;
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'nunjucks-caller-'));
      // WHY: simulates an Express helper that calls render() — the template literal lives in a different file, so this readable caller source does NOT contain it.
      wrapperPath = join(tempDir, 'wrapper.ts');
      await writeFile(
        wrapperPath,
        'export const renderTemplate = async (tpl, ctx) => render(tpl, ctx);\n'
      );
      // WHY: the real caller (e.g. a route handler) that owns the template literal — one frame above the wrapper.
      callerPath = join(tempDir, 'route.ts');
      await writeFile(
        callerPath,
        "import { renderTemplate } from './wrapper.ts';\nconst html = renderTemplate('{{ product.name }}', { product: { test: 'test' } });\n"
      );
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    test('falls back to template coords when the literal is absent from a single readable caller', async () => {
      const result = await resolveLocation({
        template: '{{ product.name }}',
        callerFile: wrapperPath,
        callerLocation: { lineNumber: 1, columnNumber: 52 },
        errLineno: 0,
        errColno: 3,
      });

      expect(result.preferCallerLocation).toBe(false);
      expect(result.lineBase).toBe('zero');
      expect(result.lineno).toBe(0);
      expect(result.colno).toBe(3);
      expect(result.sourceContent).toBe('{{ product.name }}');
      expect(result.templatePath).toBeNull();
    });

    test('walks up the caller frames to the file that actually contains the literal', async () => {
      const result = await resolveLocation({
        template: '{{ product.name }}',
        callerFrames: [
          { fileName: wrapperPath, lineNumber: 1, columnNumber: 52 },
          { fileName: callerPath, lineNumber: 2, columnNumber: 23 },
        ],
        errLineno: 0,
        errColno: 11,
      });

      expect(result.preferCallerLocation).toBe(true);
      expect(result.lineBase).toBe('one');
      expect(result.templatePath).toBe(callerPath);
      expect(result.lineno).toBe(2);
      expect(result.sourceContent).toContain("renderTemplate('{{ product.name }}'");
      // WHY: the caret must land on the missing property `name`, not on `product`.
      const callerLine = result.sourceContent?.split('\n')[(result.lineno ?? 1) - 1] ?? '';
      expect(result.colno).toBe(callerLine.indexOf('product.name') + 'product.'.length + 1);
    });
  });
});
