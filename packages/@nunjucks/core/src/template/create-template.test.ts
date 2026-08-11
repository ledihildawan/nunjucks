import { describe, test, expect } from 'bun:test';
import { createTemplate } from './create-template.ts';
import type { TemplateSource } from './types.ts';

describe('createTemplate', () => {
  test('creates template object with render method', () => {
    const template = createTemplate({ src: 'Hello {{ name }}' });
    expect(template.render).toBeDefined();
    expect(typeof template.render).toBe('function');
  });

  test('template has correct initial state', () => {
    const template = createTemplate({ src: 'Hello' });
    expect(template.compiled).toBe(false);
    expect(template.blocks).toEqual({});
    expect(template.blockMeta).toEqual({});
  });

  test('compile method exists', () => {
    const template = createTemplate({ src: 'Hello' });
    expect(template.compile).toBeDefined();
    expect(typeof template.compile).toBe('function');
  });

  test('getExported method exists', () => {
    const template = createTemplate({ src: 'Hello' });
    expect(template.getExported).toBeDefined();
    expect(typeof template.getExported).toBe('function');
  });

  test('with eagerCompile compiles immediately', () => {
    const template = createTemplate({ src: 'Hello', eagerCompile: true });
    expect(template.compiled).toBe(true);
  });

  test('with path stores path', () => {
    const template = createTemplate({ src: 'Hello', path: 'test.html' });
    expect(template.path).toBe('test.html');
  });

  test('throws on invalid source type', () => {
    expect(() => createTemplate({ src: { type: 'invalid', value: 'test' } as unknown as TemplateSource })).toThrow();
  });
});
