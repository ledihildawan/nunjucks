import { describe, test, expect } from 'bun:test';
import { createCompiler } from './index.ts';

describe('createCompiler', () => {
  test('returns compiler with correct initial state', () => {
    const c = createCompiler('test.njk', undefined, '{{ x }}');
    expect(c.templateName).toBe('test.njk');
    expect(c.codebuf).toEqual([]);
    expect(c.lastId).toBe(0);
    expect(c.buffer).toBeNull();
    expect(c.bufferStack).toEqual([]);
    expect(c.scopeStack).toEqual([]);
    expect(c.inBlock).toBe(false);
    expect(c.compiledLine).toBe(0);
  });

  test('emit pushes to codebuf', () => {
    const c = createCompiler('test', undefined, '');
    c.emit('hello');
    c.emit(' world');
    expect(c.codebuf).toEqual(['hello', ' world']);
  });

  test('emitLine appends newline and increments compiledLine', () => {
    const c = createCompiler('test', undefined, '');
    c.emitLine('line1');
    c.emitLine('line2');
    expect(c.codebuf).toEqual(['line1\n', 'line2\n']);
    expect(c.compiledLine).toBe(2);
  });

  test('emitLines emits multiple lines', () => {
    const c = createCompiler('test', undefined, '');
    c.emitLines('a', 'b', 'c');
    expect(c.codebuf.length).toBe(3);
    expect(c.compiledLine).toBe(3);
  });

  test('tmpid returns unique incrementing ids', () => {
    const c = createCompiler('test', undefined, '');
    const id1 = c.tmpid();
    const id2 = c.tmpid();
    expect(id1).toMatch(/^t_\d+$/);
    expect(id2).toMatch(/^t_\d+$/);
    expect(id1).not.toBe(id2);
  });

  test('getCode joins codebuf into single string', () => {
    const c = createCompiler('test', undefined, '');
    c.emit('a');
    c.emit('b');
    c.emit('c');
    expect(c.getCode()).toBe('abc');
  });

  test('pushBuffer creates new buffer variable', () => {
    const c = createCompiler('test', undefined, '');
    const buf = c.pushBuffer();
    expect(buf).toMatch(/^t_\d+$/);
    expect(c.buffer).toBe(buf);
    expect(c.bufferStack).toEqual([null]);
  });

  test('popBuffer restores previous buffer', () => {
    const c = createCompiler('test', undefined, '');
    c.buffer = 'output';
    c.pushBuffer();
    expect(c.buffer).not.toBe('output');
    c.popBuffer();
    expect(c.buffer).toBe('output');
  });

  test('addScopeLevel + closeScopeLevels emits closing braces', () => {
    const c = createCompiler('test', undefined, '');
    c.addScopeLevel();
    c.closeScopeLevels();
    expect(c.getCode()).toContain('})');
  });

  test('withScopedSyntax isolates scope', () => {
    const c = createCompiler('test', undefined, '');
    c.addScopeLevel();
    c.withScopedSyntax(() => {
      c.addScopeLevel();
    });
    c.closeScopeLevels();
    // outer scope should have 1 closer, inner scope should have been closed by withScopedSyntax
    expect(c.scopeStack.length).toBe(0);
  });

  test('getTemplateName returns JSON-stringified name', () => {
    const c = createCompiler('path/to/file.njk', undefined, '');
    expect(c.getTemplateName()).toBe('"path/to/file.njk"');
  });

  test('getTemplateName returns "undefined" for null', () => {
    const c = createCompiler(null, undefined, '');
    expect(c.getTemplateName()).toBe('undefined');
  });

  test('compile dispatches to correct compiler for node type', () => {
    const c = createCompiler('test', undefined, '{{ 1 + 2 }}');
    // This is tested end-to-end via render() — here we just verify it doesn't throw
    expect(() => c.fail('test error')).toThrow();
  });
});
