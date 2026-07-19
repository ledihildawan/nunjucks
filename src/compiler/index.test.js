import { describe, test, expect, beforeEach } from 'bun:test';
import { createCompiler, getSourceMapFromCompile } from './index.js';
import { nodes } from '../nodes/index.js';
import { createFrame } from '../runtime/index.js';

let compiler;

beforeEach(() => {
  compiler = createCompiler('test.njk', 'chainable', 'source');
});

describe('Compiler', () => {
  test('fail throws TemplateError', () => {
    expect(() => compiler.fail('msg', 1, 2)).toThrow();
    expect(() => compiler.fail('msg', 1, 2)).toThrow('msg');
  });

  test('_templateName returns JSON string', () => {
    expect(compiler._templateName()).toBe('"test.njk"');
  });

  test('_templateName returns undefined for null name', () => {
    const c = createCompiler(null, false, '');
    expect(c._templateName()).toBe('undefined');
  });

  test('_compileExpression throws for invalid type', () => {
    const invalidNode = { type: 'Unknown', lineno: 1, colno: 1 };
    expect(() => compiler._compileExpression(invalidNode, createFrame())).toThrow();
  });

  test('assertType throws for non-matching type', () => {
    expect(() => compiler.assertType(nodes.symbol(1, 1, 'x'), 'literal')).toThrow('assertType');
  });

  test('getCode returns compiled code', () => {
    compiler._emit('a');
    compiler._emit('b');
    expect(compiler.getCode()).toBe('ab');
  });
});

describe('getSourceMapFromCompile', () => {
  test('compiles and returns source map', () => {
    const sm = getSourceMapFromCompile('Hello', [], [], 'test.njk');
    expect(sm).toBeDefined();
    expect(sm.templateName).toBe('test.njk');
    expect(sm.mappings).toBeArray();
  });
});
