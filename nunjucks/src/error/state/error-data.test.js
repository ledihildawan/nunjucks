import { describe, test, expect } from 'bun:test';
import { createErrorData } from './error-data.js';

describe('createErrorData', () => {
  test('creates basic error data from error object', () => {
    const err = new Error('test message');
    err.lineno = 5;
    err.colno = 3;
    const data = createErrorData(err, { templateName: 'page.njk' });
    expect(data.message).toBe('test message');
    expect(data.line).toBe(5);
    expect(data.col).toBe(3);
    expect(data.templateName).toBe('page.njk');
  });

  test('extracts line from message', () => {
    const err = new Error('[Line 10, Column 5] some error');
    const data = createErrorData(err, { templateName: 't.njk' });
    expect(data.line).toBe(10);
    expect(data.col).toBe(5);
  });

  test('line override takes precedence', () => {
    const err = new Error('test');
    err.lineno = 3;
    const data = createErrorData(err, { templateName: 't.njk', line: 99 });
    expect(data.line).toBe(99);
  });

  test('generates snippet from sourceContent', () => {
    const err = new Error('test');
    err.lineno = 2;
    const data = createErrorData(err, {
      templateName: 't.njk',
      sourceContent: 'line1\nline2\nline3',
    });
    expect(data.snippet).toContain('>>> 2: line2');
  });

  test('classifies the error', () => {
    const err = new Error("attempted to output 'x' null or undefined");
    const data = createErrorData(err, { templateName: 't.njk' });
    expect(data.classified.category).toBe('undefined_variable');
  });

  test('sanitizes render context', () => {
    const err = new Error('test');
    const data = createErrorData(err, {
      templateName: 't.njk',
      renderContext: { name: 'alice', password: 'secret123' },
    });
    expect(data.renderContext.name).toBe('alice');
    expect(data.renderContext.password).toBe('***');
  });

  test('provides getDisplayLine and getDisplayCol', () => {
    const err = new Error('test');
    err.lineno = 7;
    const data = createErrorData(err, { templateName: 't.njk' });
    expect(data.getDisplayLine()).toBe(7);
    expect(data.getDisplayCol()).toBe('?');
  });

  test('sets isProduction and ide', () => {
    const err = new Error('test');
    const data = createErrorData(err, {
      templateName: 't.njk',
      isProduction: true,
      ide: 'cursor',
    });
    expect(data.isProduction).toBe(true);
    expect(data.ide).toBe('cursor');
  });
});
