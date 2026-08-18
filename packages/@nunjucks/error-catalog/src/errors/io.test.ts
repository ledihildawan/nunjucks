import { describe, expect, test } from 'bun:test';
import { classifyFromError } from './classify.ts';
import { IO_ERRORS } from './io.ts';

describe('IO_ERRORS definitions', () => {
  test('each entry is keyed by its own name and carries guidance', () => {
    for (const [name, def] of Object.entries(IO_ERRORS)) {
      expect(def.name).toBe(name);
      expect(def.category).not.toBe('');
      expect(def.causes.length).toBeGreaterThan(0);
      expect(def.fixComment).toBeTruthy();
    }
  });

  test('documentationUrls point at the includes anchor of the templating docs', () => {
    const expected =
      'https://github.com/ledihildawan/nunjucks/blob/main/docs/templating.md#includes';
    expect(IO_ERRORS.FILE_NOT_FOUND.documentationUrl).toBe(expected);
    expect(IO_ERRORS.CIRCULAR_INCLUDE.documentationUrl).toBe(expected);
  });
});

describe('FILE_NOT_FOUND', () => {
  test('pattern is anchored and captures the path', () => {
    const { pattern } = IO_ERRORS.FILE_NOT_FOUND;
    const match = 'template not found: missing.njk'.match(pattern);
    expect(match?.[1]).toBe('missing.njk');
    expect(pattern.test('template not found:')).toBe(false);
  });

  test('classification extracts the path as the subject', () => {
    const cls = classifyFromError({ message: 'template not found: views/missing.njk' });
    expect(cls.category).toBe('file_not_found');
    expect(cls.undefinedName).toBe('views/missing.njk');
  });
});

describe('CIRCULAR_INCLUDE', () => {
  test('pattern matches the exact bare message', () => {
    expect(IO_ERRORS.CIRCULAR_INCLUDE.pattern.test('Circular include detected')).toBe(true);
    expect(IO_ERRORS.CIRCULAR_INCLUDE.pattern.test('Circular include detected: a.njk')).toBe(false);
    expect(classifyFromError({ message: 'Circular include detected' }).category).toBe(
      'circular_include'
    );
  });
});

describe('FILESYSTEM_ERROR', () => {
  test('pattern captures the underlying message', () => {
    const match = 'Filesystem error: EACCES permission denied'.match(
      IO_ERRORS.FILESYSTEM_ERROR.pattern
    );
    expect(match?.[1]).toBe('EACCES permission denied');
    expect(
      classifyFromError({ message: 'Filesystem error: EACCES permission denied' }).category
    ).toBe('filesystem_error');
  });
});

describe('INVALID_INCLUDE', () => {
  test('pattern matches the exact non-string message', () => {
    expect(IO_ERRORS.INVALID_INCLUDE.pattern.test('template names must be a string')).toBe(true);
    expect(IO_ERRORS.INVALID_INCLUDE.pattern.test('template names must be a string: 42')).toBe(
      false
    );
  });
});

describe('IMPORT_ERROR', () => {
  test('pattern recognizes the quoted import shape and the module-not-found shape', () => {
    const { pattern } = IO_ERRORS.IMPORT_ERROR;
    const match = "Cannot import 'macros.njk' from module".match(pattern);
    expect(match?.[1]).toBe('macros.njk');
    expect(pattern.test('cannot find module ./macros.njm')).toBe(true);
    expect(pattern.test("Cannot import 'macros.njk' from elsewhere")).toBe(false);
  });

  test('classification extracts the imported name as the subject', () => {
    const cls = classifyFromError({ message: "Cannot import 'macros.njk' from module" });
    expect(cls.category).toBe('import_error');
    expect(cls.undefinedName).toBe('macros.njk');
    expect(cls.title).toBe('Cannot import template - module not found');
  });
});
