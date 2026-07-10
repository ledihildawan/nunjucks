import { describe, test, expect } from 'bun:test';
import { createCompilerContext } from './context.js';

describe('createCompilerContext', () => {
  test('creates context with default values', () => {
    const ctx = createCompilerContext('test.html', 'chainable', 'hello {{ x }}');
    expect(ctx.templateName).toBe('test.html');
    expect(ctx.undefinedMode).toBe('chainable');
    expect(ctx.codebuf).toEqual([]);
    expect(ctx.lastId).toBe(0);
    expect(ctx.buffer).toBeNull();
    expect(ctx.bufferStack).toEqual([]);
    expect(ctx._scopeClosers).toBe('');
    expect(ctx.inBlock).toBe(false);
    expect(ctx.compiledLine).toBe(0);
    expect(ctx.sourceMap).toBeDefined();
  });

  test('stores undefinedMode', () => {
    const ctx = createCompilerContext('t', 'strict', 'src');
    expect(ctx.undefinedMode).toBe('strict');
  });
});
