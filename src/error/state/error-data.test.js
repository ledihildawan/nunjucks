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
    const err = new Error("attempted to output 'x' null or undefined value");
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

  test('sanitizes function in context to [Function]', () => {
    const err = new Error('test');
    const data = createErrorData(err, {
      templateName: 't.njk',
      renderContext: { getName: function() {} },
    });
    expect(data.renderContext.getName).toBe('[Function]');
  });

  test('sanitizes symbol in context to [Symbol]', () => {
    const err = new Error('test');
    const data = createErrorData(err, {
      templateName: 't.njk',
      renderContext: { sym: Symbol('test') },
    });
    expect(data.renderContext.sym).toBe('[Symbol]');
  });

  test('truncates long strings at 120 chars', () => {
    const err = new Error('test');
    const longString = 'a'.repeat(150);
    const data = createErrorData(err, {
      templateName: 't.njk',
      renderContext: { text: longString },
    });
    expect(data.renderContext.text.length).toBe(121);
    expect(data.renderContext.text.endsWith('…')).toBe(true);
  });

  test('truncates context with many keys at 30', () => {
    const err = new Error('test');
    const manyKeys = {};
    for (let i = 0; i < 35; i++) manyKeys['key' + i] = i;
    const data = createErrorData(err, {
      templateName: 't.njk',
      renderContext: manyKeys,
    });
    expect(Object.keys(data.renderContext).length).toBe(31);
    expect(data.renderContext['…']).toBe('(truncated)');
  });

  test('handles null and undefined in arrays', () => {
    const err = new Error('test');
    const data = createErrorData(err, {
      templateName: 't.njk',
      renderContext: { items: [1, null, undefined, 'test'] },
    });
    expect(data.renderContext.items).toEqual([1, null, undefined, 'test']);
  });

  test('handles empty object', () => {
    const err = new Error('test');
    const data = createErrorData(err, {
      templateName: 't.njk',
      renderContext: { empty: {} },
    });
    expect(data.renderContext.empty).toEqual({});
  });

  test('handles empty array', () => {
    const err = new Error('test');
    const data = createErrorData(err, {
      templateName: 't.njk',
      renderContext: { items: [] },
    });
    expect(data.renderContext.items).toEqual([]);
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
