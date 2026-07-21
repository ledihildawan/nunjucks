import { describe, test, expect } from 'bun:test';
import { createCompilerContext } from './context.ts';
import { DEFAULT_UNDEFINED_MODE } from '@nunjucks/runtime/undefined';

describe('createCompilerContext', () => {
  test('stores templateName', () => {
    const ctx = createCompilerContext('foo.njk', undefined, 'src');
    expect(ctx.templateName).toBe('foo.njk');
  });

  test('initializes empty codebuf', () => {
    const ctx = createCompilerContext('foo.njk', undefined, 'src');
    expect(ctx.codebuf).toEqual([]);
  });

  test('initializes lastId to 0', () => {
    const ctx = createCompilerContext('foo.njk', undefined, 'src');
    expect(ctx.lastId).toBe(0);
  });

  test('initializes buffer to null', () => {
    const ctx = createCompilerContext('foo.njk', undefined, 'src');
    expect(ctx.buffer).toBeNull();
  });

  test('initializes empty bufferStack', () => {
    const ctx = createCompilerContext('foo.njk', undefined, 'src');
    expect(ctx.bufferStack).toEqual([]);
  });

  test('initializes _scopeClosers to empty string', () => {
    const ctx = createCompilerContext('foo.njk', undefined, 'src');
    expect(ctx._scopeClosers).toBe('');
  });

  test('initializes inBlock to false', () => {
    const ctx = createCompilerContext('foo.njk', undefined, 'src');
    expect(ctx.inBlock).toBe(false);
  });

  test('defaults undefinedMode to DEFAULT_UNDEFINED_MODE', () => {
    const ctx = createCompilerContext('foo.njk', undefined, 'src');
    expect(ctx.undefinedMode).toBe(DEFAULT_UNDEFINED_MODE);
  });

  test('uses provided undefinedMode', () => {
    const ctx = createCompilerContext('foo.njk', 'strict', 'src');
    expect(ctx.undefinedMode).toBe('strict');
  });

  test('initializes compiledLine to 0', () => {
    const ctx = createCompilerContext('foo.njk', undefined, 'src');
    expect(ctx.compiledLine).toBe(0);
  });

  test('creates a sourceMap bound to templateName', () => {
    const ctx = createCompilerContext('foo.njk', undefined, 'src');
    expect(ctx.sourceMap).toBeDefined();
    expect(ctx.sourceMap.templateName).toBe('foo.njk');
    expect(ctx.sourceMap.mappings).toEqual([]);
  });

  test('supports null templateName', () => {
    const ctx = createCompilerContext(null, undefined, '');
    expect(ctx.templateName).toBeNull();
    expect(ctx.sourceMap.templateName).toBeNull();
  });
});
