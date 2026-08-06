import { describe, test, expect } from 'bun:test';
import { ERROR_DEFINITIONS } from '@nunjucks/log';

describe('error messages - sample output', () => {
  test('UNDEFINED_VARIABLE message includes subject', async () => {
    const { createLog } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.UNDEFINED_VARIABLE, { name: 'user.something' }, 'user.something', {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero'
    }) as import('@nunjucks/log').TemplateError;
    expect(err.subject).toBe('user.something');
    expect(err.message).toContain('user.something');
    expect(err.causes!.length).toBeGreaterThan(0);
    expect(err.fixCode).toBeTruthy();
  });

  test('NULL_VALUE error handles nested access', async () => {
    const { createLog } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.NULL_VALUE, { accessPath: 'name', parent: 'user', state: 'null' }, 'name', {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero'
    });
    expect(err.message).toContain('name');
    expect(err.message).toContain('user');
  });

  test('FILE_NOT_FOUND has helpful message', async () => {
    const { createLog } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.FILE_NOT_FOUND, { path: 'missing.njk' }, 'missing.njk', {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero'
    }) as import('@nunjucks/log').TemplateError;
    expect(err.message).toContain('missing.njk');
    expect(err.fixCode).toBeTruthy();
  });

  test('UNDEFINED_FILTER has helpful fix', async () => {
    const { createLog } = await import('@nunjucks/log');
    const err = createLog('error', ERROR_DEFINITIONS.UNDEFINED_FILTER, { name: 'myFilter' }, 'myFilter', {
      lineno: 1, colno: 0, phase: 'render', lineBase: 'zero'
    }) as import('@nunjucks/log').TemplateError;
    expect(err.message).toContain('myFilter');
    expect(err.fixCode).toContain('addFilter');
  });
});

describe('classify', () => {
  test('classification substitutes placeholders in causes', async () => {
    const { classifyFromError } = await import('./classify.ts');
    const cls = classifyFromError({
      code: 'UNDEFINED_PROPERTY',
      subject: 'something',
      message: "Property 'something' not found in 'user'"
    });

    expect(cls.causes.some(c => c.includes('something'))).toBe(true);
    expect(cls.causes.some(c => c.includes('user'))).toBe(true);
  });

  test('classification substitutes placeholders in fixCode', async () => {
    const { classifyFromError } = await import('./classify.ts');
    const cls = classifyFromError({
      code: 'UNDEFINED_FILTER',
      subject: 'myFilter',
      message: "Filter 'myFilter' is not defined"
    });

    expect(cls.fixCode).toContain('myFilter');
    expect(cls.fixCode).not.toContain('{subject}');
  });

  test('NULL_VALUE classification substitutes parent', async () => {
    const { classifyFromError } = await import('./classify.ts');
    const cls = classifyFromError({
      code: 'NULL_VALUE',
      message: "Cannot access 'name' on null 'user'"
    });

    expect(cls.causes.some(c => c.includes('user'))).toBe(true);
  });

  test('UNDEFINED_VARIABLE classification substitutes subject', async () => {
    const { classifyFromError } = await import('./classify.ts');
    const cls = classifyFromError({
      code: 'UNDEFINED_VARIABLE',
      message: "Variable 'foo' is not defined"
    });

    expect(cls.causes.some(c => c.includes('foo'))).toBe(true);
    expect(cls.fixCode).toContain('foo');
  });
});
