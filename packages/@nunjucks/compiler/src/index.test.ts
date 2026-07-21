import { describe, test, expect, beforeEach } from 'bun:test';
import { createCompiler, getSourceMapFromCompile } from '@nunjucks/compiler';
import { symbol } from '@nunjucks/nodes';
import { createFrame } from '@nunjucks/runtime/frame';

let compiler: ReturnType<typeof createCompiler>;

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
    const c = createCompiler(null, undefined, '');
    expect(c._templateName()).toBe('undefined');
  });

  test('_compileExpression throws for invalid type', () => {
    const invalidNode = { type: 'Unknown', lineno: 1, colno: 1 } as never;
    expect(() => compiler._compileExpression(invalidNode, createFrame())).toThrow();
  });

  test('assertType throws for non-matching type', () => {
    expect(() => compiler.assertType(symbol(1, 1, 'x'), 'literal')).toThrow('assertType');
  });

  test('getCode returns compiled code', () => {
    compiler._emit('a');
    compiler._emit('b');
    expect(compiler.getCode()).toBe('ab');
  });
});

describe('getSourceMapFromCompile', () => {
  test('returns source map with template name', () => {
    // NOTE: Full compile pipeline (parse + transform) is not yet available
    // in the migrated packages (@nunjucks/parser is empty). The function
    // still returns a properly-shaped SourceMap so consumers can rely on
    // the result. Once `parse` is migrated, this should compile 'Hello'
    // and produce real mappings.
    const sm = getSourceMapFromCompile('Hello', [], [], 'test.njk');
    expect(sm).toBeDefined();
    expect(sm.templateName).toBe('test.njk');
    expect(sm.mappings).toBeArray();
  });
});
