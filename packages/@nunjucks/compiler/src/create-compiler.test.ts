import { describe, expect, test } from 'bun:test';
import { literal } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime';
import { ZERO_LOC } from '@nunjucks/shared';
import { createCompiler } from './create-compiler.ts';

describe('createCompiler', () => {
  test('returns compiler with correct initial state', () => {
    const c = createCompiler({
      templateName: 'test.njk',
      undefinedMode: undefined,
      source: '{{ x }}',
    });
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
    const c = createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });
    c.emit('hello');
    c.emit(' world');
    expect(c.codebuf).toEqual(['hello', ' world']);
  });

  test('emitLine appends newline and increments compiledLine', () => {
    const c = createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });
    c.emitLine('line1');
    c.emitLine('line2');
    expect(c.codebuf).toEqual(['line1\n', 'line2\n']);
    expect(c.compiledLine).toBe(2);
  });

  test('emitLines emits multiple lines', () => {
    const c = createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });
    c.emitLines('a', 'b', 'c');
    expect(c.codebuf.length).toBe(3);
    expect(c.compiledLine).toBe(3);
  });

  test('nextCompilerId returns unique incrementing ids', () => {
    const c = createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });
    const firstCompilerId = c.nextCompilerId();
    const secondCompilerId = c.nextCompilerId();
    expect(firstCompilerId).toMatch(/^t_\d+$/);
    expect(secondCompilerId).toMatch(/^t_\d+$/);
    expect(firstCompilerId).not.toBe(secondCompilerId);
  });

  test('getCode joins codebuf into single string', () => {
    const c = createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });
    c.emit('a');
    c.emit('b');
    c.emit('c');
    expect(c.getCode()).toBe('abc');
  });

  test('pushBuffer creates new buffer variable', () => {
    const c = createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });
    const buf = c.pushBuffer();
    expect(buf).toMatch(/^t_\d+$/);
    expect(c.buffer).toBe(buf);
    expect(c.bufferStack).toEqual([null]);
  });

  test('popBuffer restores previous buffer', () => {
    const c = createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });
    c.buffer = 'output';
    c.pushBuffer();
    expect(c.buffer).not.toBe('output');
    c.popBuffer();
    expect(c.buffer).toBe('output');
  });

  test('addScopeLevel + closeScopeLevels emits closing braces', () => {
    const c = createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });
    c.addScopeLevel();
    c.closeScopeLevels();
    expect(c.getCode()).toContain('})');
  });

  test('withScopedSyntax isolates scope', () => {
    const c = createCompiler({ templateName: 'test', undefinedMode: undefined, source: '' });
    c.addScopeLevel();
    c.withScopedSyntax(() => {
      c.addScopeLevel();
    });
    c.closeScopeLevels();
    expect(c.scopeStack.length).toBe(0);
  });

  test('getTemplateName returns JSON-stringified name', () => {
    const c = createCompiler({
      templateName: 'path/to/file.njk',
      undefinedMode: undefined,
      source: '',
    });
    expect(c.getTemplateName()).toBe('"path/to/file.njk"');
  });

  test('getTemplateName returns "undefined" for null', () => {
    const c = createCompiler({ templateName: null, undefinedMode: undefined, source: '' });
    expect(c.getTemplateName()).toBe('undefined');
  });

  test('compile dispatches to correct compiler for node type', () => {
    const c = createCompiler({
      templateName: 'test',
      undefinedMode: undefined,
      source: '{{ 1 + 2 }}',
    });
    c.compile(literal(ZERO_LOC, 42), createFrame());
    expect(c.getCode()).toContain('42');
    expect(() =>
      c.compile({ type: 'no-such-type', lineno: 0, colno: 0 } as never, createFrame())
    ).toThrow();
  });
});
