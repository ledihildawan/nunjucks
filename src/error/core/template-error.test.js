import { describe, test, expect } from 'bun:test';
import { createTemplateError, prettifyError, isTemplateError } from './template-error.js';

describe('TemplateError', () => {
  test('stores message, lineno, colno', () => {
    const err = createTemplateError('test', 5, 10);
    expect(err.message).toContain('test');
    expect(err.lineno).toBe(5);
    expect(err.colno).toBe(10);
    expect(err.name).toBe('Template render error');
  });

  test('stores info fields', () => {
    const err = createTemplateError('msg', 1, 2, {
      code: 'TEST_CODE',
      subject: 'x',
      phase: 'render',
      templateName: 'tmpl.njk',
    });
    expect(err.code).toBe('TEST_CODE');
    expect(err.subject).toBe('x');
    expect(err.phase).toBe('render');
    expect(err.templateName).toBe('tmpl.njk');
  });

  test('omits null/undefined info fields', () => {
    const err = createTemplateError('msg', 1, 2, { subject: null, templateName: undefined });
    expect(err.subject).toBeUndefined();
    expect(err.templateName).toBeUndefined();
  });

  test('applyLocation prepends path and line info', () => {
    const err = createTemplateError('boom', 3, 7);
    err.applyLocation('test.njk');
    expect(err.message).toContain('(test.njk)');
    expect(err.message).toContain('[Line 4, Column 8]');
  });

  test('applyLocation includes chain info', () => {
    const err = createTemplateError('boom', 3, 7);
    const chain = { parentTmpl: 'base.njk', parentLineno: 10, parentColno: 5 };
    err.applyLocation('child.njk', chain);
    expect(err.message).toContain('included from base.njk:10:5');
  });

  test('applyLocation always prepends path', () => {
    const err = createTemplateError('boom', 3, 7);
    err.applyLocation('a.njk');
    err.firstUpdate = false;
    err.applyLocation('b.njk');
    expect(err.message).toContain('b.njk');
  });

  test('applyLocation returns this', () => {
    const err = createTemplateError('msg', 1, 1);
    expect(err.applyLocation('t')).toBe(err);
  });
});

describe('createTemplateError', () => {
  test('creates TemplateError with given args', () => {
    const err = createTemplateError('err', 2, 3, { phase: 'compile' });
    expect(isTemplateError(err)).toBe(true);
    expect(err.lineno).toBe(2);
    expect(err.phase).toBe('compile');
  });
});

describe('prettifyError', () => {
  test('formats error with path info', () => {
    const err = new Error('something broke');
    err.lineno = 5;
    err.colno = 3;
    const result = prettifyError({ path: 'page.njk', err });
    expect(result.message).toContain('page.njk');
  });

  test('keeps internals when withInternals is true', () => {
    const err = createTemplateError('test', 1, 2);
    const result = prettifyError({ path: 't.njk', err, withInternals: true });
    expect(isTemplateError(result)).toBe(true);
  });

  test('strips internals by default', () => {
    const err = createTemplateError('test', 1, 2);
    const result = prettifyError({ path: 't.njk', err });
    expect(result).toBeInstanceOf(Error);
    expect(isTemplateError(result)).toBe(false);
  });
});
